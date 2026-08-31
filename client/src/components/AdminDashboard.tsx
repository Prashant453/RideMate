import React, { useState } from "react";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import {
  ShieldCheck,
  Users,
  CarFront,
  Building2,
  MapPin,
  Megaphone,
  Ban,
  Check,
  X,
  Plus,
  RefreshCw,
  Crown,
  Sparkles,
} from "lucide-react";

type AdminTab = "stats" | "users" | "rides" | "locations" | "broadcast";

export function AdminDashboard({ userRole }: { userRole: "admin" | "super_admin" | "user" }) {
  const [tab, setTab] = useState<AdminTab>("stats");
  const isSuperAdmin = userRole === "super_admin";

  // Queries & Mutations
  const utils = trpc.useUtils();
  const statsQuery = trpc.admin.stats.useQuery(undefined, { enabled: userRole !== "user" });
  const usersQuery = trpc.admin.users.useQuery(undefined, { enabled: userRole !== "user" });
  const ridesQuery = trpc.admin.rides.useQuery(undefined, { enabled: userRole !== "user" && tab === "rides" });
  const collegesQuery = trpc.colleges.useQuery();

  // Verification & Role Mutations
  const verifyMutation = trpc.admin.updateVerification.useMutation({
    onSuccess: () => {
      toast.success("User verification status updated!");
      usersQuery.refetch();
      statsQuery.refetch();
    },
    onError: (e: any) => toast.error(e.message || "Failed to update verification"),
  });

  const roleMutation = trpc.superAdmin.updateRole.useMutation({
    onSuccess: () => {
      toast.success("User role updated!");
      usersQuery.refetch();
    },
    onError: (e: any) => toast.error(e.message || "Super Admin privileges required"),
  });

  const cancelRideMutation = trpc.admin.cancelRide.useMutation({
    onSuccess: () => {
      toast.success("Ride cancelled by admin moderation");
      ridesQuery.refetch();
      statsQuery.refetch();
    },
    onError: (e: any) => toast.error(e.message || "Could not cancel ride"),
  });

  // Location & College forms
  const [locName, setLocName] = useState("");
  const [locType, setLocType] = useState("area");
  const addLocMutation = trpc.admin.addLocation.useMutation({
    onSuccess: () => {
      toast.success("New location added!");
      setLocName("");
      utils.locations.invalidate();
    },
    onError: (e: any) => toast.error(e.message || "Could not add location"),
  });

  const [colName, setColName] = useState("");
  const [colDomain, setColDomain] = useState("");
  const addCollegeMutation = trpc.admin.addCollege.useMutation({
    onSuccess: () => {
      toast.success("New college added!");
      setColName("");
      setColDomain("");
      utils.colleges.invalidate();
    },
    onError: (e: any) => toast.error(e.message || "Could not add college"),
  });

  // Announcement form
  const [ancTitle, setAncTitle] = useState("");
  const [ancMsg, setAncMsg] = useState("");
  const [ancCollegeId, setAncCollegeId] = useState<string>("");
  const broadcastMutation = trpc.admin.broadcastAnnouncement.useMutation({
    onSuccess: () => {
      toast.success("Platform announcement broadcasted to students!");
      setAncTitle("");
      setAncMsg("");
    },
    onError: (e: any) => toast.error(e.message || "Could not send broadcast"),
  });

  // User filter
  const [userStatusFilter, setUserStatusFilter] = useState<string>("ALL");

  const filteredUsers = (usersQuery.data ?? []).filter((u: any) => {
    if (userStatusFilter === "ALL") return true;
    return (u.verification_status || "pending").toUpperCase() === userStatusFilter;
  });

  return (
    <section className="animate-enter mx-auto max-w-[1100px] space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4 rounded-[28px] bg-[#142633] p-6 text-[#f7f5ef] sm:p-8">
        <div>
          <div className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.16em] text-[#F06A3A]">
            <ShieldCheck className="h-4 w-4" /> Platform Governance {isSuperAdmin && <span className="flex items-center gap-1 rounded-full bg-[#F06A3A] px-2 py-0.5 text-[9px] text-white"><Crown className="h-3 w-3" /> SUPER ADMIN</span>}
          </div>
          <h1 className="mt-2 font-display text-[36px] font-semibold tracking-[-0.05em] sm:text-[44px]">Admin Dashboard</h1>
          <p className="mt-1 text-[13px] text-[#b4c4b7]">Supabase RBAC Enforced Management · Enforcing student verification, moderation & routes.</p>
        </div>
        <button onClick={() => { statsQuery.refetch(); usersQuery.refetch(); }} className="flex items-center gap-1.5 rounded-xl border border-[#2a4050] bg-[#1a3040] px-4 py-2.5 text-[11px] font-bold text-white hover:bg-[#253e4c]">
          <RefreshCw className="h-3.5 w-3.5" /> Refresh Data
        </button>
      </div>

      {/* Admin Tabs */}
      <div className="flex gap-1 overflow-x-auto rounded-2xl bg-[#e9eee8] p-1.5 text-[12px] font-bold">
        <button onClick={() => setTab("stats")} className={`rounded-xl px-4 py-2.5 transition ${tab === "stats" ? "bg-[#fffdfa] text-[#142633] shadow-xs" : "text-[#61766b]"}`}>
          <Users className="mr-1.5 inline h-4 w-4 text-[#F06A3A]" /> Stats & Overview
        </button>
        <button onClick={() => setTab("users")} className={`rounded-xl px-4 py-2.5 transition ${tab === "users" ? "bg-[#fffdfa] text-[#142633] shadow-xs" : "text-[#61766b]"}`}>
          <ShieldCheck className="mr-1.5 inline h-4 w-4 text-[#356344]" /> Verifications & Users
        </button>
        <button onClick={() => setTab("rides")} className={`rounded-xl px-4 py-2.5 transition ${tab === "rides" ? "bg-[#fffdfa] text-[#142633] shadow-xs" : "text-[#61766b]"}`}>
          <CarFront className="mr-1.5 inline h-4 w-4 text-[#31546f]" /> Ride Moderation
        </button>
        <button onClick={() => setTab("locations")} className={`rounded-xl px-4 py-2.5 transition ${tab === "locations" ? "bg-[#fffdfa] text-[#142633] shadow-xs" : "text-[#61766b]"}`}>
          <MapPin className="mr-1.5 inline h-4 w-4 text-[#a94e31]" /> Colleges & Locations
        </button>
        <button onClick={() => setTab("broadcast")} className={`rounded-xl px-4 py-2.5 transition ${tab === "broadcast" ? "bg-[#fffdfa] text-[#142633] shadow-xs" : "text-[#61766b]"}`}>
          <Megaphone className="mr-1.5 inline h-4 w-4 text-[#F06A3A]" /> Announcements
        </button>
      </div>

      {/* Tab 1: Stats & Overview */}
      {tab === "stats" && (
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          <div className="route-sheet rounded-[24px] border border-[#dfe5df] bg-[#fffdfa] p-5">
            <span className="eyebrow">Total Users</span>
            <div className="mt-3 font-display text-[36px] font-semibold text-[#142633]">{statsQuery.data?.totalUsers ?? 0}</div>
            <p className="mt-1 text-[11px] text-[#718078]">Registered student accounts</p>
          </div>
          <div className="route-sheet rounded-[24px] border border-[#dfe5df] bg-[#fffdfa] p-5">
            <span className="eyebrow text-[#356344]">Verified Students</span>
            <div className="mt-3 font-display text-[36px] font-semibold text-[#356344]">{statsQuery.data?.verifiedUsers ?? 0}</div>
            <p className="mt-1 text-[11px] text-[#718078]">Approved by Admin</p>
          </div>
          <div className="route-sheet rounded-[24px] border border-[#dfe5df] bg-[#fffdfa] p-5">
            <span className="eyebrow text-[#F06A3A]">Total Rides</span>
            <div className="mt-3 font-display text-[36px] font-semibold text-[#142633]">{statsQuery.data?.totalRides ?? 0}</div>
            <p className="mt-1 text-[11px] text-[#718078]">Created across campus</p>
          </div>
          <div className="route-sheet rounded-[24px] border border-[#dfe5df] bg-[#fffdfa] p-5">
            <span className="eyebrow text-[#31546f]">Active Live Rides</span>
            <div className="mt-3 font-display text-[36px] font-semibold text-[#31546f]">{statsQuery.data?.openRides ?? 0}</div>
            <p className="mt-1 text-[11px] text-[#718078]">Open for seat requests</p>
          </div>
        </div>
      )}

      {/* Tab 2: Verifications & User Management */}
      {tab === "users" && (
        <div className="route-sheet rounded-[26px] border border-[#dfe5df] bg-[#fffdfa] p-5 sm:p-7">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <span className="eyebrow">User Management</span>
              <h2 className="mt-1 font-display text-[26px] font-semibold tracking-[-0.04em]">Verification & Role Review</h2>
            </div>
            {/* Filter buttons */}
            <div className="flex flex-wrap gap-1 rounded-xl bg-[#f1f4ef] p-1 text-[10px] font-bold">
              {["ALL", "PENDING", "VERIFIED", "REJECTED", "SUSPENDED"].map((f) => (
                <button key={f} onClick={() => setUserStatusFilter(f)} className={`rounded-lg px-2.5 py-1.5 transition ${userStatusFilter === f ? "bg-[#142633] text-white" : "text-[#61766b]"}`}>
                  {f}
                </button>
              ))}
            </div>
          </div>

          <div className="mt-5 grid gap-3">
            {usersQuery.isLoading && <div className="py-8 text-center text-[12px] text-[#718078]">Loading student profiles…</div>}
            {filteredUsers.map((u: any) => {
              const status = (u.verification_status || "pending").toLowerCase();
              return (
                <div key={u.id} className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-[#e6e9e2] bg-[#fbfcf8] p-4 text-[12px]">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-[#142633]">{u.name || "Student"}</span>
                      <span className="text-[11px] text-[#718078]">({u.email})</span>
                      <span className={`rounded-full px-2 py-0.5 text-[9px] font-bold uppercase ${status === "verified" ? "bg-[#e6f1e8] text-[#356344]" : status === "pending" ? "bg-[#fff0e7] text-[#b64f2d]" : "bg-[#fde8e8] text-[#a93131]"}`}>
                        {status}
                      </span>
                      <span className="rounded-full bg-[#142633] px-2 py-0.5 text-[9px] font-bold uppercase text-white">
                        {u.role || "user"}
                      </span>
                    </div>
                    <div className="text-[11px] text-[#718078]">
                      {u.colleges?.name ?? "College not set"} · Course: {u.course || "N/A"} · Phone: {u.phone_number || "Not set"}
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    {/* Verification Actions */}
                    <button
                      disabled={verifyMutation.isPending}
                      onClick={() => verifyMutation.mutate({ userId: u.id, status: "verified" })}
                      className="flex items-center gap-1 rounded-xl bg-[#356344] px-3 py-1.5 text-[10px] font-bold text-white transition hover:bg-[#284c34] disabled:opacity-50"
                    >
                      <Check className="h-3 w-3" /> Verify
                    </button>

                    <button
                      disabled={verifyMutation.isPending}
                      onClick={() => verifyMutation.mutate({ userId: u.id, status: "pending" })}
                      className="flex items-center gap-1 rounded-xl bg-[#F06A3A] px-3 py-1.5 text-[10px] font-bold text-white transition hover:bg-[#d85d31] disabled:opacity-50"
                    >
                      Pending
                    </button>

                    <button
                      disabled={verifyMutation.isPending}
                      onClick={() => verifyMutation.mutate({ userId: u.id, status: "suspended" })}
                      className="flex items-center gap-1 rounded-xl bg-[#a93131] px-3 py-1.5 text-[10px] font-bold text-white transition hover:bg-[#852525] disabled:opacity-50"
                    >
                      <Ban className="h-3 w-3" /> Suspend
                    </button>

                    {/* SUPER ADMIN Role Selector */}
                    {isSuperAdmin && (
                      <select
                        value={u.role || "user"}
                        onChange={(e) => roleMutation.mutate({ userId: u.id, newRole: e.target.value as any })}
                        className="rounded-xl border border-[#dfe5df] bg-[#fffdfa] px-2 py-1.5 text-[10px] font-bold text-[#142633]"
                      >
                        <option value="user">Role: USER</option>
                        <option value="admin">Role: ADMIN</option>
                        <option value="super_admin">Role: SUPER_ADMIN</option>
                      </select>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Tab 3: Ride Moderation */}
      {tab === "rides" && (
        <div className="route-sheet rounded-[26px] border border-[#dfe5df] bg-[#fffdfa] p-5 sm:p-7">
          <span className="eyebrow">Content Moderation</span>
          <h2 className="mt-1 font-display text-[26px] font-semibold tracking-[-0.04em]">All Platform Rides</h2>
          <div className="mt-5 grid gap-3 sm:grid-cols-2">
            {ridesQuery.isLoading && <div className="col-span-full py-8 text-center text-[12px] text-[#718078]">Loading rides for moderation…</div>}
            {(ridesQuery.data ?? []).map((r: any) => (
              <div key={r.id} className="rounded-2xl border border-[#e6e9e2] bg-[#fbfcf8] p-4 text-[12px]">
                <div className="flex items-start justify-between">
                  <div>
                    <div className="font-bold text-[#142633]">Driver: {r.profiles?.name || "Student"}</div>
                    <div className="mt-0.5 text-[11px] text-[#718078]">{r.profiles?.email}</div>
                  </div>
                  <span className={`rounded-full px-2 py-0.5 text-[9px] font-bold uppercase ${r.status === "open" ? "bg-[#e6f1e8] text-[#356344]" : "bg-[#fde8e8] text-[#a93131]"}`}>
                    {r.status}
                  </span>
                </div>
                <div className="mt-3 flex items-center justify-between border-t border-[#edf0eb] pt-3">
                  <div className="text-[11px] font-bold text-[#30433e]">Departure: {new Date(r.departure_at).toLocaleString([], { dateStyle: "short", timeStyle: "short" })}</div>
                  {r.status !== "cancelled" && (
                    <button
                      onClick={() => cancelRideMutation.mutate({ rideId: r.id })}
                      className="rounded-xl bg-[#a93131] px-3 py-1.5 text-[10px] font-bold text-white hover:bg-[#852525]"
                    >
                      <X className="mr-1 inline h-3 w-3" /> Remove Ride
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Tab 4: Colleges & Locations Management */}
      {tab === "locations" && (
        <div className="grid gap-6 md:grid-cols-2">
          {/* Add Campus Location */}
          <div className="route-sheet rounded-[26px] border border-[#dfe5df] bg-[#fffdfa] p-5 sm:p-7">
            <span className="eyebrow">Map Locations</span>
            <h2 className="mt-1 font-display text-[24px] font-semibold tracking-[-0.04em]">Add Campus Route Stop</h2>
            <div className="mt-4 space-y-3">
              <label className="field">
                <span>Location Name</span>
                <input value={locName} onChange={(e) => setLocName(e.target.value)} placeholder="e.g. Naugaon / DBUU Gate 2" />
              </label>
              <label className="field">
                <span>Type</span>
                <select value={locType} onChange={(e) => setLocType(e.target.value)}>
                  <option value="area">Area Stop</option>
                  <option value="campus">Campus Gate</option>
                </select>
              </label>
              <button
                disabled={!locName || addLocMutation.isPending}
                onClick={() => addLocMutation.mutate({ name: locName, type: locType })}
                className="mt-2 flex w-full items-center justify-center gap-1.5 rounded-2xl bg-[#142633] py-3 text-[11px] font-bold text-white disabled:opacity-50"
              >
                <Plus className="h-4 w-4" /> Add Location Stop
              </button>
            </div>
          </div>

          {/* Add College */}
          <div className="route-sheet rounded-[26px] border border-[#dfe5df] bg-[#fffdfa] p-5 sm:p-7">
            <span className="eyebrow">Colleges</span>
            <h2 className="mt-1 font-display text-[24px] font-semibold tracking-[-0.04em]">Add Partner College</h2>
            <div className="mt-4 space-y-3">
              <label className="field">
                <span>College Name</span>
                <input value={colName} onChange={(e) => setColName(e.target.value)} placeholder="e.g. Graphic Era / DBUU" />
              </label>
              <label className="field"><span>Email Domain (optional)</span><input value={colDomain} onChange={(e) => setColDomain(e.target.value)} placeholder="e.g. dbuu.ac.in" /></label>
              <button
                disabled={!colName || addCollegeMutation.isPending}
                onClick={() => addCollegeMutation.mutate({ name: colName, domain: colDomain || undefined })}
                className="mt-2 flex w-full items-center justify-center gap-1.5 rounded-2xl bg-[#142633] py-3 text-[11px] font-bold text-white disabled:opacity-50"
              >
                <Plus className="h-4 w-4" /> Add College Institution
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Tab 5: Broadcast Announcements */}
      {tab === "broadcast" && (
        <div className="route-sheet rounded-[26px] border border-[#dfe5df] bg-[#fffdfa] p-5 sm:p-7">
          <span className="eyebrow text-[#F06A3A]">Platform Announcements</span>
          <h2 className="mt-1 font-display text-[26px] font-semibold tracking-[-0.04em]">Broadcast Notification to Students</h2>
          <div className="mt-5 space-y-4 max-w-[650px]">
            <label className="field">
              <span>Announcement Title</span>
              <input value={ancTitle} onChange={(e) => setAncTitle(e.target.value)} placeholder="e.g. Campus Route Advisory / Monsoon Notice" />
            </label>
            <label className="field">
              <span>Target College (optional)</span>
              <select value={ancCollegeId} onChange={(e) => setAncCollegeId(e.target.value)}>
                <option value="">All Colleges & Campus Students</option>
                {(collegesQuery.data ?? []).map((c: any) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </label>
            <label className="field">
              <span>Message Content</span>
              <textarea value={ancMsg} onChange={(e) => setAncMsg(e.target.value)} rows={4} placeholder="Type announcement message to broadcast..." />
            </label>
            <button
              disabled={!ancTitle || !ancMsg || broadcastMutation.isPending}
              onClick={() => broadcastMutation.mutate({ title: ancTitle, message: ancMsg, targetCollegeId: ancCollegeId ? Number(ancCollegeId) : undefined })}
              className="flex items-center justify-center gap-2 rounded-2xl bg-[#F06A3A] px-6 py-3.5 text-[12px] font-bold text-white shadow-xs transition hover:bg-[#d85d31] disabled:opacity-50"
            >
              <Megaphone className="h-4 w-4" /> Broadcast Announcement
            </button>
          </div>
        </div>
      )}
    </section>
  );
}
