import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { withSupabase } from "npm:@supabase/server@^1";

// Only current, active management staff can change a Fuelman's login status.
// The original auth user and all operational history remain intact.
const managers = new Set(["gl", "admin", "atasan"]);
const validActions = new Set(["deactivate", "reactivate"]);

function cleanUsername(input: unknown): string {
  const value = String(input ?? "").trim().toLowerCase();
  return /^[a-z0-9._-]{3,64}$/.test(value) ? value : "";
}
function reply(error: string, status: number): Response {
  return Response.json({ error }, { status });
}

export default {
  fetch: withSupabase({ auth: "user" }, async (req, ctx) => {
    if (req.method !== "POST") return reply("Metode tidak diizinkan.", 405);
    try {
      const actorId = ctx.userClaims?.id;
      if (!actorId) return reply("Sesi login tidak valid.", 401);
      const { data: caller, error: callerErr } = await ctx.supabaseAdmin
        .from("staff_profiles")
        .select("user_id,role,active")
        .eq("user_id", actorId).maybeSingle();
      if (callerErr || !caller || caller.active !== true || !managers.has(caller.role))
        return reply("Hanya GL, Admin, atau Atasan aktif yang boleh mengelola akun Fuelman.", 403);

      const payload = await req.json();
      const username = cleanUsername(payload?.username);
      const action = String(payload?.action ?? "");
      const reason = String(payload?.reason ?? "").trim().replace(/\s+/g, " ");
      if (!username || !validActions.has(action))
        return reply("Username atau tindakan tidak valid.", 400);
      if (reason.length < 8 || reason.length > 400)
        return reply("Alasan pergantian wajib 8–400 karakter.", 400);

      const { data: target, error: targetErr } = await ctx.supabaseAdmin
        .from("staff_profiles")
        .select("user_id,username,display_name,role,active")
        .eq("username", username).maybeSingle();
      if (targetErr || !target)
        return reply("Akun tidak ditemukan.", 404);
      if (target.role !== "fuelman")
        return reply("Menu pergantian ini hanya untuk akun Fuelman.", 403);
      if (target.user_id === actorId)
        return reply("Tidak dapat mengubah status akun sendiri.", 403);

      const nextActive = action === "reactivate";
      if (target.active === nextActive) {
        return Response.json({ ok: true, unchanged: true,
          username, active: nextActive,
          message: "Status akun sudah sesuai. Tidak ada perubahan." });
      }

      // A still-active session owns FT/MT closing and must be ended first.
      if (!nextActive) {
        const { data: sessions, error: sessionErr } = await ctx.supabaseAdmin
          .from("fuelman_sessions").select("id,tanggal,shift,duty_type,fuel_truck")
          .eq("user_id", target.user_id).eq("status", "ACTIVE").limit(1);
        if (sessionErr) return reply("Gagal memastikan status shift. Tidak ada perubahan.", 503);
        if (sessions?.length)
          return reply("Petugas masih punya shift aktif. Selesaikan Closing/End Shift atau gunakan End Shift Admin terlebih dahulu.", 409);
      }

      const setProfile = async (active: boolean) => {
        const { data, error } = await ctx.supabaseAdmin.from("staff_profiles")
          .update({ active }).eq("user_id", target.user_id)
          .eq("active", !active).select("user_id").maybeSingle();
        if (error || !data) throw new Error(error?.message || "Status profil berubah sebelum diproses. Muat ulang daftar anggota.");
      };
      const setAuthBan = async (active: boolean) => {
        const { error } = await ctx.supabaseAdmin.auth.admin.updateUserById(
          target.user_id, { ban_duration: active ? "none" : "876000h" });
        if (error) throw new Error("Perubahan akses login gagal: " + error.message);
      };

      // Deactivation closes app permissions first, before banning login.
      // Reactivation unbans while the database role is still inactive.
      let profileChanged = false, authChanged = false;
      try {
        if (nextActive) {
          await setAuthBan(true); authChanged = true;
          await setProfile(true); profileChanged = true;
        } else {
          await setProfile(false); profileChanged = true;
          await setAuthBan(false); authChanged = true;
        }
        const { error: auditErr } = await ctx.supabaseAdmin
          .from("staff_account_status_audit").insert({
            target_user_id: target.user_id,
            username: target.username,
            actor_user_id: actorId,
            action: nextActive ? "REACTIVATE" : "DEACTIVATE",
            previous_active: target.active,
            new_active: nextActive,
            reason,
          });
        if (auditErr) throw new Error("Gagal mencatat audit pergantian: " + auditErr.message);
      } catch (error) {
        // Best effort rollback on partial completion; never claim success.
        const rollbackErrors: string[] = [];
        if (profileChanged) {
          const { error: e } = await ctx.supabaseAdmin.from("staff_profiles")
            .update({ active: target.active }).eq("user_id", target.user_id);
          if (e) rollbackErrors.push("profil");
        }
        if (authChanged) {
          const { error: e } = await ctx.supabaseAdmin.auth.admin.updateUserById(
            target.user_id, { ban_duration: target.active ? "none" : "876000h" });
          if (e) rollbackErrors.push("login");
        }
        console.error("Fuelman status update failed", { actorId, username,
          reason: String(error), rollbackErrors });
        if (rollbackErrors.length)
          return reply("Status akun belum konsisten (" + rollbackErrors.join(",") +
            "). Jangan ulangi tindakan. Hubungi Admin untuk pemeriksaan Supabase.", 500);
        return reply(error instanceof Error ? error.message : "Perubahan akun gagal.", 500);
      }
      return Response.json({ ok: true, username, active: nextActive,
        message: nextActive
          ? "Akun " + target.display_name + " sudah diaktifkan kembali."
          : "Akun " + target.display_name + " telah dinonaktifkan. Buat akun baru untuk petugas pengganti." });
    } catch (error) {
      console.error("manage-fuelman-account",error);
      return reply("Pengelolaan akun gagal. Muat ulang dan periksa status akun sebelum mencoba lagi.",500);
    }
  }),
};