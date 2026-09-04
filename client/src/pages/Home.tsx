/* RideMate / Campus Wayfinding — persistent Supabase-backed product surface. */
import { useEffect, useMemo, useState, type ReactNode } from "react";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";
import { usePushNotifications } from "@/hooks/usePushNotifications";
import { trpc } from "@/lib/trpc";
import { supabase } from "@/lib/supabase";
import { buildSearchWindow } from "@/lib/searchFilters";
import { FindRideFilters } from "@/components/FindRideFilters";
import { ChatModal } from "@/components/ChatModal";
import { AdminDashboard } from "@/components/AdminDashboard";
import {
  ArrowRight,
  Bell,
  Bike,
  CalendarDays,
  CarFront,
  Check,
  Clock3,
  Compass,
  House,
  LogOut,
  MapPin,
  Menu,
  MessageSquare,
  Navigation,
  Phone,
  Plus,
  Search,
  Settings2,
  ShieldCheck,
  Sparkles,
  Star,
  Trash2,
  UserRound,
  Users,
  X,
} from "lucide-react";

type View = "home" | "find" | "offer" | "rides" | "profile" | "admin";
type DisplayRide = { id: number; time: string; origin: string; destination: string; name: string; rating: string; vehicle: string; seats: number };
type RidesTab = "offered" | "requested";

/* ── tiny inline auth form ── */
function AuthForm({ onSuccess }: { onSuccess?: () => void }) {
  const [mode, setMode] = useState<"login" | "register">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [loading, setLoading] = useState(false);
  const [showResend, setShowResend] = useState(false);
  const [resending, setResending] = useState(false);
  const { signIn, signUp, resendVerificationEmail } = useAuth();

  const submit = async () => {
    if (!email || !password) { toast.error("Enter email and password"); return; }
    if (mode === "register" && !name) { toast.error("Enter your name"); return; }
    setLoading(true);
    const res = mode === "register" ? await signUp(email, password, name) : await signIn(email, password);
    setLoading(false);
    if (res.error) {
      toast.error(res.error);
      if (res.error.toLowerCase().includes("not confirmed") || res.error.toLowerCase().includes("verify your email")) {
        setShowResend(true);
      }
      return;
    }
    if (mode === "register") {
      toast.success("Account created! Please check your email inbox to confirm your account.");
      setShowResend(true);
    } else {
      toast.success("Welcome back!");
      onSuccess?.();
    }
  };

  const handleResend = async () => {
    if (!email) { toast.error("Please enter your college email first"); return; }
    setResending(true);
    const res = await resendVerificationEmail(email);
    setResending(false);
    if (res.error) {
      toast.error(res.error);
    } else {
      toast.success("Verification email resent! Please check your inbox and spam folder.");
    }
  };

  return (
    <div className="rounded-[24px] bg-[#142633] p-6 text-center text-[#f7f5ef]">
      <ShieldCheck className="mx-auto h-7 w-7 text-[#F06A3A]" />
      <h2 className="mt-3 font-display text-[27px] font-semibold">{mode === "login" ? "Sign in to RideMate" : "Create your account"}</h2>
      <p className="mx-auto mt-2 max-w-[360px] text-[12px] leading-5 text-[#b4c4b7]">Verified students only. Use your college email.</p>
      <div className="mx-auto mt-5 grid max-w-[320px] gap-3">
        {mode === "register" && <input value={name} onChange={e => setName(e.target.value)} placeholder="Full name" className="rounded-xl border border-[#2a4050] bg-[#1a3040] px-3 py-3 text-[12px] text-white placeholder-[#708077] outline-none" />}
        <input value={email} onChange={e => setEmail(e.target.value)} placeholder="College email" type="email" className="rounded-xl border border-[#2a4050] bg-[#1a3040] px-3 py-3 text-[12px] text-white placeholder-[#708077] outline-none" />
        <input value={password} onChange={e => setPassword(e.target.value)} placeholder="Password" type="password" className="rounded-xl border border-[#2a4050] bg-[#1a3040] px-3 py-3 text-[12px] text-white placeholder-[#708077] outline-none" onKeyDown={e => e.key === "Enter" && submit()} />
        <button disabled={loading} onClick={submit} className="rounded-xl bg-[#F06A3A] py-3 text-[11px] font-bold text-white disabled:opacity-60">{loading ? "Please wait…" : mode === "login" ? "Sign in" : "Create account"}</button>
        {showResend && (
          <button
            type="button"
            disabled={resending}
            onClick={handleResend}
            className="text-[11px] font-semibold text-[#F06A3A] underline underline-offset-4 hover:text-[#d85d31] disabled:opacity-60"
          >
            {resending ? "Resending email..." : "Resend confirmation email"}
          </button>
        )}
        <button onClick={() => { setMode(mode === "login" ? "register" : "login"); setShowResend(false); }} className="text-[11px] font-bold text-[#b4c4b7] underline underline-offset-4">{mode === "login" ? "Need an account? Register" : "Already have an account? Sign in"}</button>
      </div>
    </div>
  );
}

function Logo() {
  return <div className="flex items-center gap-2.5"><div className="relative flex h-9 w-9 items-center justify-center rounded-[13px] bg-[#142633] shadow-[0_5px_0_#F06A3A]"><div className="absolute left-[9px] top-[9px] h-2.5 w-2.5 rounded-full bg-[#F06A3A]" /><div className="absolute bottom-[8px] right-[8px] h-2.5 w-2.5 rounded-full border-2 border-[#F06A3A]" /><div className="absolute left-[14px] top-[14px] h-[12px] w-[2px] rotate-[42deg] bg-[#F06A3A]" /></div><span className="font-display text-[25px] font-semibold tracking-[-0.05em] text-[#142633]">RideMate</span></div>;
}

function StatusPill({ children, tone = "green" }: { children: ReactNode; tone?: "green" | "orange" | "blue" | "red" }) {
  const styles = { green: "bg-[#e6f1e8] text-[#356344]", orange: "bg-[#fff0e7] text-[#b64f2d]", blue: "bg-[#e8f0f7] text-[#31546f]", red: "bg-[#fde8e8] text-[#a93131]" };
  return <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.12em] ${styles[tone]}`}>{children}</span>;
}

function RideCard({ ride, onRequest, requested }: { ride: DisplayRide; onRequest: () => void; requested: boolean }) {
  const VehicleIcon = ride.vehicle === "Car" ? CarFront : Bike;
  return <article className="route-sheet group rounded-[24px] border border-[#dfe5df] bg-[#fffdfa] p-4 shadow-[0_10px_25px_rgba(20,38,51,0.045)] transition duration-200 hover:-translate-y-0.5 hover:shadow-[0_15px_30px_rgba(20,38,51,0.09)] sm:p-5"><div className="flex items-start justify-between gap-3"><div><div className="mb-2 flex items-center gap-2"><Clock3 className="h-4 w-4 text-[#F06A3A]" /><span className="font-display text-[23px] font-semibold tracking-[-0.04em] text-[#142633]">{ride.time}</span></div><div className="flex items-center gap-2 text-[13px] font-semibold text-[#30433e]"><span>{ride.origin}</span><ArrowRight className="h-3.5 w-3.5 text-[#98a69d]" /><span>{ride.destination}</span></div></div><StatusPill><span className="h-1.5 w-1.5 rounded-full bg-[#4f8b61]" />Open</StatusPill></div><div className="my-4 h-px bg-[#ecf0eb]" /><div className="flex items-center justify-between gap-2"><div className="flex items-center gap-2.5"><div className="flex h-8 w-8 items-center justify-center rounded-full bg-[#dfeae2] text-xs font-bold text-[#356344]">{ride.name.split(" ").map((part) => part[0]).join("").slice(0, 2)}</div><div><div className="text-[12px] font-bold text-[#142633]">{ride.name}</div><div className="mt-0.5 flex items-center gap-1 text-[11px] text-[#7b8982]"><Star className="h-3 w-3 fill-[#F06A3A] text-[#F06A3A]" /> {ride.rating} <span className="mx-0.5">·</span> {ride.rating === "New" ? "New student" : "Verified"}</div></div></div><div className="flex items-center gap-1.5 rounded-lg bg-[#f1f4ef] px-2 py-1.5 text-[11px] font-semibold text-[#50665b]"><VehicleIcon className="h-3.5 w-3.5" />{ride.vehicle}</div></div><div className="mt-4 flex items-center justify-between"><span className="text-[11px] font-semibold text-[#77867c]">{ride.seats} {ride.seats === 1 ? "seat" : "seats"} available</span><button disabled={requested} onClick={onRequest} className={`rounded-full px-3.5 py-2 text-[11px] font-bold transition active:scale-[0.97] ${requested ? "bg-[#e6f1e8] text-[#356344]" : "bg-[#F06A3A] text-white hover:bg-[#d85d31]"}`}>{requested ? <><Check className="mr-1 inline h-3.5 w-3.5" />Requested</> : "Request seat"}</button></div></article>;
}

function LoadingState({ label }: { label: string }) { return <div className="rounded-[24px] border border-dashed border-[#cbd7cd] bg-[#eef4ec] p-10 text-center text-[12px] font-bold text-[#61766b]"><div className="mx-auto mb-3 h-5 w-5 animate-spin rounded-full border-2 border-[#cbd7cd] border-t-[#F06A3A]" />{label}</div>; }
function ErrorState({ label, onRetry }: { label: string; onRetry: () => void }) { return <div className="rounded-[24px] border border-dashed border-[#efc8ba] bg-[#fff0e7] p-8 text-center"><p className="text-[12px] font-bold text-[#a94e31]">{label}</p><button onClick={onRetry} className="mt-3 rounded-full bg-[#fffdfa] px-4 py-2 text-[11px] font-bold text-[#a94e31]">Try again</button></div>; }

function StarInput({ value, onChange }: { value: number; onChange: (v: number) => void }) {
  return <div className="flex gap-1">{[1,2,3,4,5].map(s => <button key={s} onClick={() => onChange(s)} className="p-0.5"><Star className={`h-5 w-5 ${s <= value ? "fill-[#F06A3A] text-[#F06A3A]" : "text-[#cbd7cd]"}`} /></button>)}</div>;
}

/* 🔔 Notification dropdown with Supabase Realtime & Navigation support 🔔 */
function NotificationBell({ onNavigate }: { onNavigate?: (targetView: View) => void }) {
  const { user, isAuthenticated } = useAuth();
  const [open, setOpen] = useState(false);
  const countQuery = trpc.notifications.unreadCount.useQuery(undefined, { enabled: isAuthenticated, refetchInterval: 30000 });
  const listQuery = trpc.notifications.list.useQuery(undefined, { enabled: isAuthenticated && open });
  const markReadMutation = trpc.notifications.markRead.useMutation({ onSuccess: () => { countQuery.refetch(); listQuery.refetch(); } });
  const markAllMutation = trpc.notifications.markAllRead.useMutation({ onSuccess: () => { countQuery.refetch(); listQuery.refetch(); } });
  const count = (countQuery.data ?? 0) as number;
  
  const { isSupported, permission, isSubscribed, subscribe } = usePushNotifications();

  useEffect(() => {
    if (!isAuthenticated || !user?.id) return;

    const channel = supabase
      .channel(`user_notifications_${user.id}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "notifications",
          filter: `user_id=eq.${user.id}`,
        },
        (payload) => {
          const newNotif = payload.new as any;
          if (newNotif) {
            countQuery.refetch();
            if (open) listQuery.refetch();

            toast.info(newNotif.title || "Notification", {
              description: newNotif.message,
            });
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [isAuthenticated, user?.id, open]);

  const handleNotificationClick = (n: any) => {
    if (!n.is_read) {
      markReadMutation.mutate({ id: n.id });
    }
    setOpen(false);
    if (onNavigate && n.reference_id) {
      onNavigate("rides");
    }
  };

  return (
    <div className="relative">
      <button onClick={() => { 
        if (!isAuthenticated) { toast("Sign in to see notifications"); return; } 
        if (isSupported && !isSubscribed && permission === 'default') { subscribe(); }
        setOpen(!open); 
      }} aria-label="Notifications" className="relative flex h-10 w-10 items-center justify-center rounded-full border border-[#dfe5df] bg-[#fffdfa] text-[#5e7168]">
        <Bell className="h-4 w-4" />
        {count > 0 && <span className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-[#F06A3A] px-1 text-[9px] font-bold text-white">{count > 9 ? "9+" : count}</span>}
      </button>
      {open && <div className="absolute right-0 top-12 z-50 w-[320px] rounded-2xl border border-[#dfe5df] bg-[#fffdfa] p-3 shadow-xl">
        <div className="mb-2 flex items-center justify-between"><span className="text-[11px] font-bold text-[#7b8982]">Notifications</span>{count > 0 && <button onClick={() => markAllMutation.mutate()} className="text-[10px] font-bold text-[#F06A3A]">Mark all read</button>}</div>
        {listQuery.isLoading && <div className="py-4 text-center text-[11px] text-[#7b8982]">Loading…</div>}
        {listQuery.data?.length === 0 && <div className="py-4 text-center text-[11px] text-[#7b8982]">No notifications yet</div>}
        <div className="max-h-[300px] space-y-1 overflow-y-auto">{(listQuery.data ?? []).slice(0, 10).map((n: any) => (
          <div key={n.id} onClick={() => handleNotificationClick(n)} className={`cursor-pointer rounded-xl px-3 py-2 text-[11px] transition hover:bg-[#f1f4ef] ${n.is_read ? "text-[#7b8982]" : "bg-[#fff0e7] font-bold text-[#142633]"}`}>
            <div className="flex items-center justify-between"><span className="font-bold">{n.title}</span>{!n.is_read && <span className="h-2 w-2 rounded-full bg-[#F06A3A]" />}</div>
            <div className="mt-0.5 text-[10px] text-[#7b8982]">{n.message}</div>
          </div>
        ))}</div>
        <button onClick={() => setOpen(false)} className="mt-2 w-full text-center text-[10px] font-bold text-[#7b8982]">Close</button>
      </div>}
    </div>
  );
}

/* 📞 Component: CallButton */
function CallButton({ rideId, targetUserId }: { rideId: number; targetUserId: string }) {
  const [loading, setLoading] = useState(false);

  const handleCall = async () => {
    setLoading(true);
    try {
      // Force fetch directly from DB to bypass any stale TRPC backend deployments
      const { data, error } = await supabase.rpc('get_confirmed_contact_info', { 
        p_ride_id: rideId, 
        p_target_user_id: targetUserId 
      });
      
      if (error) {
        throw error;
      }

      if (!data?.phone_number) {
        toast.info("The other person hasn't added a phone number.");
      } else {
        // Natively trigger phone dialer
        window.location.href = `tel:${data.phone_number}`;
      }
    } catch (err: any) {
      toast.error(err?.message || "Failed to fetch contact");
    } finally {
      setLoading(false);
    }
  };

  return (
    <button 
      onClick={handleCall}
      disabled={loading}
      className="flex items-center gap-1 rounded-lg bg-[#356344] px-3 py-1.5 text-[10px] font-bold text-white shadow-xs hover:bg-[#284a33] transition disabled:opacity-70"
    >
      <Phone className="h-3 w-3" /> {loading ? "..." : "Call"}
    </button>
  );
}

export default function Home() {
  const [view, setView] = useState<View>("home");
  const [menuOpen, setMenuOpen] = useState(false);
  const [requestedIds, setRequestedIds] = useState<number[]>([]);
  const [from, setFrom] = useState("DBUU");
  const [to, setTo] = useState("Bhauwala");
  const [time, setTime] = useState("4:30 PM");
  const [flexibility, setFlexibility] = useState(30);
  const [isHomeCustomTime, setIsHomeCustomTime] = useState(false);
  const [draftFrom, setDraftFrom] = useState("DBUU");
  const [draftTo, setDraftTo] = useState("Bhauwala");
  const [draftTime, setDraftTime] = useState("4:30 PM");
  const [draftFlexibility, setDraftFlexibility] = useState(30);
  const [searchRefreshToken, setSearchRefreshToken] = useState(0);
  const [offerFrom, setOfferFrom] = useState("DBUU");
  const [offerTo, setOfferTo] = useState("Bhauwala");
  const [offerDate, setOfferDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [offerTime, setOfferTime] = useState("16:30");
  const [offerSeats, setOfferSeats] = useState("1");
  const [offerVehicleId, setOfferVehicleId] = useState<string>("");
  const [offerNote, setOfferNote] = useState("");
  const [offerPreview, setOfferPreview] = useState(false);
  const [profileName, setProfileName] = useState("");
  const [profileCourse, setProfileCourse] = useState("");
  const [profileYear, setProfileYear] = useState("");
  const [profilePhone, setProfilePhone] = useState("");
  const [ridesTab, setRidesTab] = useState<RidesTab>("offered");
  const [viewingRequestsForRide, setViewingRequestsForRide] = useState<number | null>(null);
  const [showAdminDevPanel, setShowAdminDevPanel] = useState(false);
  
  // Real-time Chat modal state
  const [activeChat, setActiveChat] = useState<{ rideId: number; otherUserId: string; otherUserName: string } | null>(null);

  // Vehicle form
  const [showAddVehicle, setShowAddVehicle] = useState(false);
  const [vType, setVType] = useState<string>("bike");
  const [vModel, setVModel] = useState("");
  const [vReg, setVReg] = useState("");
  const [vSeats, setVSeats] = useState("1");
  // Rating form
  const [ratingRideId, setRatingRideId] = useState<number | null>(null);
  const [ratingToUserId, setRatingToUserId] = useState<string>("");
  const [ratingValue, setRatingValue] = useState(0);
  const [ratingReview, setRatingReview] = useState("");

  const { user, isAuthenticated, logout } = useAuth();
  const locationsQuery = trpc.locations.useQuery();
  const collegesQuery = trpc.colleges.useQuery();
  const utils = trpc.useUtils();
  const destinationLocation = locationsQuery.data?.find((location: any) => location.name === to);
  const originLocation = locationsQuery.data?.find((location: any) => location.name === from);
  const searchWindow = useMemo(() => buildSearchWindow(time, flexibility), [time, flexibility]);
  const backendRidesQuery = trpc.rides.search.useQuery({ originLocationId: originLocation?.id, destinationLocationId: destinationLocation?.id, ...searchWindow, refreshToken: searchRefreshToken, limit: 20, offset: 0 }, { enabled: view === "find" && Boolean(destinationLocation?.id) });
  const requestSeatMutation = trpc.rides.requestSeat.useMutation({ onSuccess: async (_: any, input: any) => { setRequestedIds((current) => Array.from(new Set([...current, input.rideId]))); toast.success("Seat request sent", { description: "The driver will see your request in their ride inbox." }); await utils.rides.search.invalidate(); }, onError: (error: any) => toast.error(error.message.includes("not available") ? "That ride is not available" : "Could not request this seat", { description: "Please refresh and try again." }) });
  const createRideMutation = trpc.rides.create.useMutation({ onSuccess: async () => { setOfferPreview(false); toast.success("Ride published", { description: "Your route is now stored for other students to discover." }); await utils.rides.mine.invalidate(); }, onError: () => toast.error("Could not publish this ride", { description: "Check the route and try again." }) });
  const locationsById = useMemo(() => new Map((locationsQuery.data ?? []).map((location: any) => [location.id, location.name])), [locationsQuery.data]);
  const backendRides = useMemo(() => (backendRidesQuery.data ?? []).map((ride: any) => ({ id: ride.id, time: new Date(ride.departureAt).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" }), origin: locationsById.get(ride.originLocationId) ?? from, destination: locationsById.get(ride.destinationLocationId) ?? to, name: ride.driverName ?? "RideMate student", rating: ride.driverRating ? Number(ride.driverRating).toFixed(1) : "New", vehicle: ride.vehicleType ? `${ride.vehicleType[0].toUpperCase()}${ride.vehicleType.slice(1)}` : "Vehicle", seats: ride.availableSeats })), [backendRidesQuery.data, locationsById, from, to]);
  const mineQuery = trpc.rides.mine.useQuery(undefined, { enabled: view === "rides" && isAuthenticated });
  const vehiclesQuery = trpc.vehicles.mine.useQuery(undefined, { enabled: (view === "offer" || view === "profile") && isAuthenticated });
  const profileQuery = trpc.profile.me.useQuery(undefined, { enabled: view === "profile" && isAuthenticated });
  const updateProfileMutation = trpc.profile.update.useMutation({
    onSuccess: async () => {
      toast.success("Profile saved successfully!");
      await utils.profile.me.invalidate();
    },
    onError: (error: any) => {
      toast.error(error.message || "Failed to save profile. Please try again.");
    },
  });
  const rideRequestsQuery = trpc.rides.requests.useQuery({ rideId: viewingRequestsForRide! }, { enabled: viewingRequestsForRide !== null });

  // Admin Verification Queries & Mutations
  const adminUsersQuery = trpc.admin.users.useQuery(undefined, { enabled: view === "profile" && isAuthenticated });
  const updateVerificationMutation = trpc.admin.updateVerification.useMutation({
    onSuccess: () => {
      toast.success("User verification status updated!");
      adminUsersQuery.refetch();
      utils.profile.me.invalidate();
    },
    onError: (e: any) => toast.error(e.message || "Could not update verification status"),
  });


  // Mutations
  const acceptRequestMutation = trpc.rides.acceptRequest.useMutation({ onSuccess: () => { toast.success("Request accepted"); rideRequestsQuery.refetch(); utils.rides.mine.invalidate(); }, onError: (e: any) => toast.error(e.message || "Could not accept") });
  const rejectRequestMutation = trpc.rides.rejectRequest.useMutation({ onSuccess: () => { toast.success("Request rejected"); rideRequestsQuery.refetch(); }, onError: () => toast.error("Could not reject") });
  const cancelRequestMutation = trpc.rides.cancelRequest.useMutation({ onSuccess: () => { toast.success("Request cancelled"); utils.rides.mine.invalidate(); }, onError: () => toast.error("Could not cancel request") });
  const cancelRideMutation = trpc.rides.cancel.useMutation({ onSuccess: () => { toast.success("Ride cancelled"); utils.rides.mine.invalidate(); }, onError: () => toast.error("Could not cancel ride") });
  const completeRideMutation = trpc.rides.complete.useMutation({ onSuccess: () => { toast.success("Ride completed!"); utils.rides.mine.invalidate(); }, onError: () => toast.error("Could not complete ride") });
  const addVehicleMutation = trpc.vehicles.add.useMutation({ onSuccess: () => { toast.success("Vehicle added"); setShowAddVehicle(false); setVModel(""); setVReg(""); utils.vehicles.mine.invalidate(); }, onError: () => toast.error("Could not add vehicle") });
  const deleteVehicleMutation = trpc.vehicles.delete.useMutation({ onSuccess: () => { toast.success("Vehicle removed"); utils.vehicles.mine.invalidate(); }, onError: () => toast.error("Could not remove vehicle") });
  const submitRatingMutation = trpc.ratings.submit.useMutation({ onSuccess: () => { toast.success("Rating submitted"); setRatingRideId(null); setRatingValue(0); setRatingReview(""); }, onError: () => toast.error("Could not submit rating") });

  useEffect(() => {
    const profile = (profileQuery.data as any)?.user;
    if (profile) {
      setProfileName(profile.name ?? "");
      setProfileCourse(profile.course ?? "");
      setProfileYear(profile.year ?? "");
      setProfilePhone((profile.phone_number ?? profile.phoneNumber ?? user?.user_metadata?.phone_number ?? "").toString());
    }
  }, [profileQuery.data, user]);

  // Real-time Ride Feed synchronization & Offline/Focus recovery
  useEffect(() => {
    const ridesChannel = supabase
      .channel("realtime_rides_feed")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "rides",
        },
        () => {
          utils.rides.search.invalidate();
          if (isAuthenticated) utils.rides.mine.invalidate();
        }
      )
      .subscribe();

    const handleSync = () => {
      utils.rides.search.invalidate();
      if (isAuthenticated) utils.rides.mine.invalidate();
    };

    window.addEventListener("online", handleSync);
    window.addEventListener("focus", handleSync);

    return () => {
      supabase.removeChannel(ridesChannel);
      window.removeEventListener("online", handleSync);
      window.removeEventListener("focus", handleSync);
    };
  }, [utils, isAuthenticated]);

  const nav = (next: View) => {
    if (next === "find") {
      setDraftFrom(from);
      setDraftTo(to);
      setDraftTime(time);
      setDraftFlexibility(flexibility);
    }
    setView(next);
    setMenuOpen(false);
    setViewingRequestsForRide(null);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const applyFindFilters = () => {
    setFrom(draftFrom);
    setTo(draftTo);
    setTime(draftTime);
    setFlexibility(draftFlexibility);
    setSearchRefreshToken((current) => current + 1);
  };

  const requireAuth = (message: string) => { toast(message, { description: "Please sign in or create an account." }); };
  const request = (id: number) => { if (!isAuthenticated) { requireAuth("Sign in to request a seat"); return; } requestSeatMutation.mutate({ rideId: id }); };
  const publishRide = () => {
    if (!isAuthenticated) { requireAuth("Sign in to offer a ride"); return; }
    const originId = locationsQuery.data?.find((location: any) => location.name === offerFrom)?.id;
    const destinationId = locationsQuery.data?.find((location: any) => location.name === offerTo)?.id;
    if (!originId || !destinationId) { toast.error("Choose a valid campus route"); return; }
    createRideMutation.mutate({ originLocationId: originId, destinationLocationId: destinationId, departureAt: new Date(`${offerDate}T${offerTime}`), availableSeats: Number(offerSeats), vehicleId: offerVehicleId ? Number(offerVehicleId) : undefined, notes: offerNote || undefined });
  };

  const statusTone = (s: string): "green" | "orange" | "blue" | "red" => {
    if (s === "open") return "green";
    if (s === "completed") return "blue";
    if (s === "cancelled" || s === "expired") return "red";
    return "orange";
  };

  const mobileNav = (key: View, Icon: typeof House, label: string) => <button onClick={() => nav(key)} className={`flex min-w-[54px] flex-col items-center gap-1 text-[9px] font-bold ${view === key ? "text-[#F06A3A]" : "text-[#859189]"}`}><span className={`flex h-8 w-8 items-center justify-center rounded-xl ${view === key ? "bg-[#fff0e7]" : ""}`}><Icon className="h-4 w-4" /></span>{label}</button>;

  return <div className="min-h-screen bg-[#f7f5ef] text-[#142633]">
    <header className="wayfinding-rail sticky top-0 z-30 border-b border-[#e6e9e2]/80 bg-[#f7f5ef]/95 backdrop-blur-md"><div className="mx-auto flex h-[72px] max-w-[1380px] items-center justify-between px-5 sm:px-8 lg:px-12"><button onClick={() => nav("home")} aria-label="RideMate home"><Logo /></button><nav className="hidden items-center gap-7 text-[12px] font-bold text-[#708077] lg:flex">{( ( (profileQuery.data as any)?.user?.role === "admin" || (profileQuery.data as any)?.user?.role === "super_admin" ) ? [["home", "Home"], ["find", "Find a ride"], ["offer", "Offer a ride"], ["rides", "My rides"], ["admin", "Admin"]] : [["home", "Home"], ["find", "Find a ride"], ["offer", "Offer a ride"], ["rides", "My rides"]] ).map(([key, label]) => <button key={key} onClick={() => nav(key as View)} className={`transition hover:text-[#142633] ${view === key ? "text-[#142633]" : ""}`}>{label}</button>)}</nav><div className="flex items-center gap-2.5"><NotificationBell onNavigate={nav} /><button onClick={() => isAuthenticated ? nav("profile") : nav("profile")} className="hidden items-center gap-2 rounded-full border border-[#dfe5df] bg-[#fffdfa] py-1.5 pl-1.5 pr-3 text-left sm:flex"><div className="flex h-7 w-7 items-center justify-center rounded-full bg-[#dfeae2] text-[10px] font-bold text-[#356344]">{(user?.user_metadata?.name ?? user?.email ?? "G").slice(0, 2).toUpperCase()}</div><span className="text-[11px] font-bold text-[#30433e]">{user?.user_metadata?.name ?? user?.email?.split("@")[0] ?? "Guest"}</span></button><button onClick={() => setMenuOpen(!menuOpen)} className="flex h-10 w-10 items-center justify-center rounded-full border border-[#dfe5df] bg-[#fffdfa] lg:hidden"><Menu className="h-4 w-4" /></button></div></div>{menuOpen && <div className="border-t border-[#e6e9e2] bg-[#fffdfa] px-5 py-4 lg:hidden"><div className="grid gap-1">{(( (profileQuery.data as any)?.user?.role === "admin" || (profileQuery.data as any)?.user?.role === "super_admin" ) ? [["home", "Home"], ["find", "Find a ride"], ["offer", "Offer a ride"], ["rides", "My rides"], ["profile", "Profile"], ["admin", "Admin"]] : [["home", "Home"], ["find", "Find a ride"], ["offer", "Offer a ride"], ["rides", "My rides"], ["profile", "Profile"]]).map(([key, label]) => <button key={key} onClick={() => nav(key as View)} className="rounded-xl px-3 py-3 text-left text-sm font-bold text-[#30433e] hover:bg-[#f1f4ef]">{label}</button>)}</div></div>}</header>

    <main className="mx-auto max-w-[1380px] px-5 pb-28 pt-7 sm:px-8 lg:ml-[210px] lg:px-12 lg:pb-14 lg:pt-10">
      {/* ── ADMIN DASHBOARD ── */}
      {view === "admin" && <AdminDashboard userRole={(profileQuery.data as any)?.user?.role ?? "user"} />}
      {/* ── HOME ── */}
      {view === "home" && <><section className="relative overflow-hidden rounded-[30px] bg-[#dfe9df] px-6 pb-7 pt-8 sm:px-10 sm:pb-10 lg:min-h-[390px] lg:px-14 lg:pt-14"><img src="/campus-hero.svg" alt="A campus road through the foothills" className="absolute inset-0 h-full w-full object-cover opacity-75 mix-blend-multiply" /><div className="absolute inset-0 bg-gradient-to-r from-[#dfe9df] via-[#dfe9df]/85 to-transparent" /><div className="relative max-w-[490px]"><StatusPill tone="orange"><Sparkles className="h-3 w-3" /> DBUU campus network</StatusPill><h1 className="mt-5 font-display text-[48px] font-semibold leading-[0.94] tracking-[-0.065em] text-[#142633] sm:text-[65px]">Your campus.<br /><em className="font-normal text-[#356344]">Your route.</em><br />Your ride.</h1><p className="mt-5 max-w-[365px] text-[14px] leading-6 text-[#41564c]">Share the trip you already need to make with verified students heading the same way.</p><div className="mt-7 flex flex-wrap gap-3"><button onClick={() => nav("find")} className="flex items-center gap-2 rounded-full bg-[#F06A3A] px-5 py-3.5 text-[12px] font-bold text-white shadow-[0_8px_16px_rgba(240,106,58,0.2)] transition active:scale-[0.97] hover:bg-[#d85d31]">Find a ride <ArrowRight className="h-4 w-4" /></button><button onClick={() => nav("offer")} className="flex items-center gap-2 rounded-full border border-[#718879] bg-[#eff4ec]/70 px-5 py-3.5 text-[12px] font-bold text-[#304d40] transition hover:bg-[#fffdfa]">Offer a ride <Plus className="h-4 w-4" /></button></div></div><div className="absolute bottom-6 right-8 hidden w-[240px] rounded-[20px] border border-white/70 bg-[#fffdfa]/90 p-4 shadow-[0_18px_30px_rgba(20,38,51,0.12)] backdrop-blur-sm lg:block"><div className="flex items-center justify-between"><span className="text-[10px] font-bold uppercase tracking-[0.16em] text-[#7b8982]">Next departure</span><StatusPill>Live</StatusPill></div><div className="mt-3 flex items-end justify-between"><div><div className="font-display text-[32px] font-semibold tracking-[-0.06em]">4:30</div><div className="text-[11px] font-semibold text-[#708077]">Today · open seats</div></div><div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#f1f4ef]"><Navigation className="h-4 w-4 text-[#F06A3A]" /></div></div><div className="mt-4 flex items-center gap-2 text-[11px] font-bold text-[#30433e]"><span>DBUU</span><div className="h-px flex-1 bg-[#bfcfc2]" /><span>Bhauwala</span></div></div></section><section className="mt-10 grid gap-6 lg:grid-cols-[1.1fr_0.9fr]"><div className="route-sheet rounded-[25px] border border-[#dfe5df] bg-[#fffdfa] p-5 sm:p-7"><div className="flex items-start justify-between"><div><span className="eyebrow">Quick search</span><h2 className="mt-2 font-display text-[30px] font-semibold tracking-[-0.05em]">Where are you headed?</h2></div><div className="hidden rounded-2xl bg-[#f1f4ef] p-3 sm:block"><Compass className="h-5 w-5 text-[#51705e]" /></div></div><div className="mt-6 grid gap-3 sm:grid-cols-2">
  <label className="field"><span>From</span><select value={from} onChange={(event) => setFrom(event.target.value)}>{(locationsQuery.data ?? []).map((location: any) => <option key={location.id}>{location.name}</option>)}</select></label>
  <label className="field"><span>To</span><select value={to} onChange={(event) => setTo(event.target.value)}>{(locationsQuery.data ?? []).map((location: any) => <option key={location.id}>{location.name}</option>)}</select></label>
  <label className="field"><span>Date</span><div className="field-value"><CalendarDays className="h-4 w-4 text-[#F06A3A]" /> Today</div></label>
  <label className="field">
    <span>Around time</span>
    {!isHomeCustomTime ? (
      <select
        value={time}
        onChange={(event) => {
          if (event.target.value === "custom") {
            setIsHomeCustomTime(true);
            setTime("16:30");
          } else {
            setTime(event.target.value);
          }
        }}
      >
        <option value="4:30 PM">4:30 PM</option>
        <option value="5:00 PM">5:00 PM</option>
        <option value="6:00 PM">6:00 PM</option>
        <option value="custom">Custom time…</option>
      </select>
    ) : (
      <div className="flex items-center gap-1">
        <input
          type="time"
          value={time.includes(":") ? time : "16:30"}
          onChange={(e) => setTime(e.target.value)}
          className="w-full bg-transparent font-bold outline-none text-[#142633]"
        />
        <button
          type="button"
          onClick={() => {
            setIsHomeCustomTime(false);
            setTime("4:30 PM");
          }}
          className="text-[10px] text-[#718078] underline"
        >
          Slots
        </button>
      </div>
    )}
  </label>
  <label className="field sm:col-span-2">
    <span>Search flexibility</span>
    <select value={flexibility} onChange={(e) => setFlexibility(Number(e.target.value))}>
      <option value={0}>Exact (±0 min)</option>
      <option value={15}>±15 min</option>
      <option value={30}>±30 min</option>
      <option value={60}>±1 hour</option>
    </select>
  </label>
</div><button onClick={() => nav("find")} className="mt-5 flex w-full items-center justify-center gap-2 rounded-2xl bg-[#142633] py-3.5 text-[12px] font-bold text-white transition active:scale-[0.99] hover:bg-[#253e4c]">Find matching rides <ArrowRight className="h-4 w-4" /></button></div><div className="relative overflow-hidden rounded-[25px] bg-[#142633] p-6 text-[#f7f5ef] sm:p-7"><div className="relative"><span className="eyebrow text-[#b8c9bd]">How it works</span><h2 className="mt-2 max-w-[280px] font-display text-[31px] font-semibold leading-[1] tracking-[-0.05em]">One simple route. A better way there.</h2><div className="mt-7 grid gap-4"><div className="flex gap-3"><span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[#F06A3A] text-[11px] font-bold">1</span><div><p className="text-[12px] font-bold">Choose your route</p><p className="mt-1 text-[11px] leading-5 text-[#afc0b4]">Pick a predefined campus stop and a time window.</p></div></div><div className="flex gap-3"><span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[#77947f] text-[11px] font-bold">2</span><div><p className="text-[12px] font-bold">See the best matches</p><p className="mt-1 text-[11px] leading-5 text-[#afc0b4]">The database filters by route, time, and open seats.</p></div></div><div className="flex gap-3"><span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[#d5e0d5] text-[11px] font-bold text-[#142633]">3</span><div><p className="text-[12px] font-bold">Request a seat</p><p className="mt-1 text-[11px] leading-5 text-[#afc0b4]">The driver confirms and the request is stored.</p></div></div></div></div></div></section></>}

      {/* ── FIND ── */}
      {view === "find" && <section className="animate-enter"><div className="mb-7 flex items-end justify-between gap-4"><div><span className="eyebrow">Find a ride</span><h1 className="mt-2 font-display text-[42px] font-semibold tracking-[-0.06em]">Rides going your way.</h1><p className="mt-2 text-[13px] text-[#718078]">{from} → {to} · Today · around {time}</p></div><button onClick={() => nav("home")} className="hidden items-center gap-1.5 text-[12px] font-bold text-[#61766b] sm:flex"><X className="h-4 w-4" /> Clear search</button></div><FindRideFilters locations={locationsQuery.data ?? []} from={draftFrom} to={draftTo} time={draftTime} flexibility={draftFlexibility} updating={backendRidesQuery.isFetching} onFromChange={setDraftFrom} onToChange={setDraftTo} onTimeChange={setDraftTime} onFlexibilityChange={setDraftFlexibility} onUpdate={applyFindFilters} /><div className="flex items-center justify-between"><h2 className="font-display text-[25px] font-semibold tracking-[-0.04em]">{backendRidesQuery.isSuccess ? `${backendRides.length} nearby matches` : "Nearby matches"}</h2><span className="text-[11px] font-bold uppercase tracking-[0.12em] text-[#8a978f]">Best match first</span></div><div className="mt-4">{backendRidesQuery.isLoading && <LoadingState label="Looking across the campus route…" />}{backendRidesQuery.isError && <ErrorState label="We couldn't load rides right now." onRetry={() => void backendRidesQuery.refetch()} />}{backendRidesQuery.isSuccess && backendRides.length === 0 && <div className="rounded-[24px] border border-dashed border-[#cbd7cd] bg-[#eef4ec] p-10 text-center"><Search className="mx-auto h-6 w-6 text-[#819b8a]" /><p className="mt-3 text-[13px] font-bold text-[#43614d]">No rides on this route yet.</p><p className="mt-1 text-[11px] text-[#708077]">Offer the first ride and help someone else get home.</p><button onClick={() => nav("offer")} className="mt-4 rounded-full bg-[#F06A3A] px-4 py-2.5 text-[11px] font-bold text-white">Offer a ride <ArrowRight className="ml-1 inline h-3 w-3" /></button></div>}{backendRidesQuery.isSuccess && backendRides.length > 0 && <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">{backendRides.map((ride) => <RideCard key={ride.id} ride={ride} requested={requestedIds.includes(ride.id)} onRequest={() => request(ride.id)} />)}</div>}</div></section>}

      {/* ── OFFER ── */}
      {view === "offer" && <section className="animate-enter mx-auto max-w-[980px]"><div className="mb-7"><span className="eyebrow">Offer a ride</span><h1 className="mt-2 font-display text-[42px] font-semibold tracking-[-0.06em]">Put an empty seat to work.</h1><p className="mt-2 max-w-[500px] text-[13px] leading-6 text-[#718078]">Your selections are saved when you publish. Students discover the route from the database-backed search.</p></div>{!isAuthenticated ? <AuthForm onSuccess={() => {}} /> : <div className="grid gap-6 lg:grid-cols-[1fr_320px]"><div className="route-sheet rounded-[25px] border border-[#dfe5df] bg-[#fffdfa] p-5 sm:p-7"><div className="grid gap-4 sm:grid-cols-2"><label className="field"><span>From</span><select value={offerFrom} onChange={(event) => setOfferFrom(event.target.value)}>{(locationsQuery.data ?? []).map((location: any) => <option key={location.id}>{location.name}</option>)}</select></label><label className="field"><span>To</span><select value={offerTo} onChange={(event) => setOfferTo(event.target.value)}>{(locationsQuery.data ?? []).map((location: any) => <option key={location.id}>{location.name}</option>)}</select></label><label className="field"><span>Date</span><input type="date" value={offerDate} onChange={(event) => setOfferDate(event.target.value)} /></label><label className="field"><span>Departure time</span><input type="time" value={offerTime} onChange={(event) => setOfferTime(event.target.value)} /></label><label className="field"><span>Vehicle</span><select value={offerVehicleId} onChange={(event) => setOfferVehicleId(event.target.value)}><option value="">No vehicle linked</option>{(vehiclesQuery.data ?? []).map((vehicle: any) => <option key={vehicle.id} value={vehicle.id}>{vehicle.model} · {vehicle.type}</option>)}</select></label><label className="field"><span>Available seats</span><select value={offerSeats} onChange={(event) => setOfferSeats(event.target.value)}><option value="1">1 seat</option><option value="2">2 seats</option><option value="3">3 seats</option></select></label></div><label className="field mt-4"><span>Note <small>(optional)</small></span><textarea value={offerNote} onChange={(event) => setOfferNote(event.target.value)} placeholder="e.g. I can pick up near the main gate" rows={3} /></label><button onClick={() => setOfferPreview(true)} className="mt-5 flex w-full items-center justify-center gap-2 rounded-2xl bg-[#142633] py-3.5 text-[12px] font-bold text-white transition active:scale-[0.99] hover:bg-[#253e4c]">{offerPreview ? <><Check className="h-4 w-4" /> Preview updated</> : <>Preview your ride <ArrowRight className="h-4 w-4" /></>}</button></div><div className="route-preview"><span className="eyebrow">Preview</span><h3 className="mt-2 font-display text-[27px] font-semibold tracking-[-0.05em]">Your ride sheet</h3><div className="my-6 h-px bg-[#d7e0d7]" /><div className="flex items-center gap-3 text-[12px] font-bold"><Clock3 className="h-4 w-4 text-[#F06A3A]" /> {offerDate} · {offerTime}</div><div className="my-6 flex items-center gap-3 text-[12px] font-bold text-[#30433e]"><span className="h-2.5 w-2.5 rounded-full bg-[#F06A3A]" />{offerFrom} <ArrowRight className="h-3 w-3" /> <span className="h-2.5 w-2.5 rounded-full bg-[#356344]" />{offerTo}</div><div className="flex items-center justify-between rounded-xl bg-[#f1f4ef] px-3 py-3 text-[11px] font-bold text-[#52645b]"><span><Bike className="mr-1.5 inline h-3.5 w-3.5" /> {offerVehicleId ? "Linked vehicle" : "Vehicle to be added"}</span><span>{offerSeats} {Number(offerSeats) === 1 ? "seat" : "seats"}</span></div><button disabled={createRideMutation.isPending} onClick={publishRide} className="mt-4 w-full rounded-xl bg-[#F06A3A] py-3 text-[11px] font-bold text-white transition hover:bg-[#d85d31] disabled:cursor-not-allowed disabled:opacity-60">{createRideMutation.isPending ? "Publishing…" : "Publish ride"}</button></div></div>}</section>}

      {/* ── MY RIDES ── */}
      {view === "rides" && <section className="animate-enter"><div className="mb-7 flex items-end justify-between"><div><span className="eyebrow">My rides</span><h1 className="mt-2 font-display text-[42px] font-semibold tracking-[-0.06em]">Keep your routes close.</h1></div><button onClick={() => nav("offer")} className="hidden items-center gap-2 rounded-full bg-[#F06A3A] px-4 py-2.5 text-[11px] font-bold text-white sm:flex"><Plus className="h-4 w-4" /> Offer a ride</button></div>
        {!isAuthenticated && <AuthForm />}
        {isAuthenticated && mineQuery.isLoading && <LoadingState label="Loading your ride history…" />}
        {isAuthenticated && mineQuery.isError && <ErrorState label="We couldn't load your rides." onRetry={() => void mineQuery.refetch()} />}
        {isAuthenticated && mineQuery.isSuccess && <>
          {/* Tabs */}
          <div className="mb-5 flex gap-1 overflow-x-auto rounded-xl bg-[#e9eee8] p-1">
            <button onClick={() => { setRidesTab("offered"); setViewingRequestsForRide(null); }} className={`rounded-lg px-4 py-2 text-[11px] font-bold ${ridesTab === "offered" ? "bg-[#fffdfa] text-[#142633] shadow-sm" : "text-[#718078]"}`}>Offered <span className="ml-1 text-[#F06A3A]">{(mineQuery.data as any).offered.length}</span></button>
            <button onClick={() => { setRidesTab("requested"); setViewingRequestsForRide(null); }} className={`rounded-lg px-4 py-2 text-[11px] font-bold ${ridesTab === "requested" ? "bg-[#fffdfa] text-[#142633] shadow-sm" : "text-[#718078]"}`}>Requested <span className="ml-1">{(mineQuery.data as any).requested.length}</span></button>
          </div>

          {/* Request detail overlay */}
          {viewingRequestsForRide !== null && <div className="mb-5 rounded-[24px] border border-[#dfe5df] bg-[#fffdfa] p-5">
            <div className="mb-3 flex items-center justify-between"><h3 className="text-[14px] font-bold">Seat Requests</h3><button onClick={() => setViewingRequestsForRide(null)} className="text-[11px] font-bold text-[#7b8982]"><X className="inline h-3.5 w-3.5" /> Close</button></div>
            {rideRequestsQuery.isLoading && <div className="text-[11px] text-[#7b8982]">Loading…</div>}
            {rideRequestsQuery.data?.length === 0 && <div className="text-[11px] text-[#7b8982]">No requests yet</div>}
            <div className="grid gap-2">{(rideRequestsQuery.data ?? []).map((req: any) => <div key={req.id} className="flex items-center justify-between rounded-xl bg-[#f1f4ef] px-3 py-3">
              <div><div className="text-[12px] font-bold">{req.profiles?.name ?? "Student"}</div><div className="mt-0.5 flex items-center gap-1 text-[10px] text-[#7b8982]"><Star className="h-3 w-3 fill-[#F06A3A] text-[#F06A3A]" /> {req.profiles?.rating ? Number(req.profiles.rating).toFixed(1) : "New"} · {req.profiles?.verification_status ?? "pending"}</div></div>
              <div className="flex items-center gap-2">
                <StatusPill tone={statusTone(req.status)}>{req.status === 'accepted' ? 'CONFIRMED' : req.status}</StatusPill>
                {req.status === "pending" && <>
                  <button onClick={() => acceptRequestMutation.mutate({ requestId: req.id })} disabled={acceptRequestMutation.isPending} className="rounded-lg bg-[#356344] px-3 py-1.5 text-[10px] font-bold text-white">Accept</button>
                  <button onClick={() => rejectRequestMutation.mutate({ requestId: req.id })} disabled={rejectRequestMutation.isPending} className="rounded-lg bg-[#a93131] px-3 py-1.5 text-[10px] font-bold text-white">Reject</button>
                </>}
                {(req.status === "accepted" || req.status === "completed") && (
                  <>
                    <button
                      onClick={() => setActiveChat({ rideId: req.ride_id, otherUserId: req.passenger_id, otherUserName: req.profiles?.name ?? "Passenger" })}
                      className="flex items-center gap-1 rounded-lg bg-[#142633] px-3 py-1.5 text-[10px] font-bold text-white shadow-xs hover:bg-[#1a2f3e] transition"
                    >
                      <MessageSquare className="h-3 w-3" /> Text
                    </button>
                    <CallButton rideId={req.ride_id} targetUserId={req.passenger_id} />
                  </>
                )}
              </div>
            </div>)}</div>
          </div>}

          {/* Offered rides */}
          {ridesTab === "offered" && <div className="grid gap-4 lg:grid-cols-2">{(mineQuery.data as any).offered.map((ride: any) => <div key={ride.id} className="route-sheet rounded-[24px] border border-[#dfe5df] bg-[#fffdfa] p-5">
            <div className="flex items-center justify-between"><StatusPill tone="blue">Your offer</StatusPill><StatusPill tone={statusTone(ride.status)}>{ride.status}</StatusPill></div>
            <div className="mt-5 font-display text-[30px] font-semibold tracking-[-0.05em]">{new Date(ride.departure_at).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}</div>
            <div className="mt-1 text-[12px] font-bold text-[#52645b]">{locationsById.get(ride.origin_location_id) ?? "Origin"} <ArrowRight className="mx-1 inline h-3 w-3 text-[#F06A3A]" /> {locationsById.get(ride.destination_location_id) ?? "Destination"}</div>
            <div className="mt-5 flex items-center justify-between border-t border-[#edf0eb] pt-4 text-[11px] text-[#748279]">
              <span>{ride.available_seats}/{ride.total_seats} seats open</span>
              <div className="flex gap-2">
                {(ride.status === "open" || ride.status === "full") && <>
                  <button onClick={() => setViewingRequestsForRide(ride.id)} className="rounded-lg bg-[#f1f4ef] px-3 py-1.5 text-[10px] font-bold text-[#356344]"><Users className="mr-1 inline h-3 w-3" />Requests</button>
                  <button onClick={() => completeRideMutation.mutate({ rideId: ride.id })} className="rounded-lg bg-[#356344] px-3 py-1.5 text-[10px] font-bold text-white"><Check className="mr-1 inline h-3 w-3" />Complete</button>
                  <button onClick={() => cancelRideMutation.mutate({ rideId: ride.id })} className="rounded-lg bg-[#a93131] px-3 py-1.5 text-[10px] font-bold text-white"><X className="mr-1 inline h-3 w-3" />Cancel</button>
                </>}
                {ride.status === "completed" && <button onClick={() => { setRatingRideId(ride.id); setRatingToUserId(""); }} className="rounded-lg bg-[#F06A3A] px-3 py-1.5 text-[10px] font-bold text-white"><Star className="mr-1 inline h-3 w-3" />Rate passengers</button>}
              </div>
            </div>
          </div>)}{(mineQuery.data as any).offered.length === 0 && <div className="col-span-full rounded-[24px] border border-dashed border-[#cbd7cd] bg-[#eef4ec] p-10 text-center"><p className="text-[12px] font-bold text-[#43614d]">No offered rides yet.</p><button onClick={() => nav("offer")} className="mt-3 rounded-full bg-[#F06A3A] px-4 py-2 text-[11px] font-bold text-white">Offer your first ride</button></div>}</div>}

          {/* Requested rides */}
          {ridesTab === "requested" && <div className="grid gap-4 lg:grid-cols-2">{(mineQuery.data as any).requested.map(({ request: req, ride }: any) => <div key={req.id} className="route-sheet rounded-[24px] border border-[#dfe5df] bg-[#fffdfa] p-5">
            <div className="flex items-center justify-between"><StatusPill tone="orange">Requested</StatusPill><StatusPill tone={statusTone(req.status)}>{req.status === 'accepted' ? 'CONFIRMED' : req.status}</StatusPill></div>
            <div className="mt-5 font-display text-[30px] font-semibold tracking-[-0.05em]">{new Date(ride.departure_at).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}</div>
            <div className="mt-1 text-[12px] font-bold text-[#52645b]">{locationsById.get(ride.origin_location_id) ?? "Origin"} <ArrowRight className="mx-1 inline h-3 w-3 text-[#F06A3A]" /> {locationsById.get(ride.destination_location_id) ?? "Destination"}</div>
            <div className="mt-5 flex items-center justify-between border-t border-[#edf0eb] pt-4 text-[11px] text-[#748279]">
              <span>Request {req.status === 'accepted' ? 'confirmed' : req.status}</span>
              <div className="flex gap-2">
                {(req.status === "accepted" || req.status === "completed") && (
                  <>
                    <button
                      onClick={() => setActiveChat({ rideId: ride.id, otherUserId: ride.driver_id, otherUserName: "Driver" })}
                      className="flex items-center gap-1 rounded-lg bg-[#142633] px-3 py-1.5 text-[10px] font-bold text-white shadow-xs hover:bg-[#1a2f3e] transition"
                    >
                      <MessageSquare className="h-3 w-3" /> Text
                    </button>
                    <CallButton rideId={ride.id} targetUserId={ride.driver_id} />
                  </>
                )}
                {(req.status === "pending" || req.status === "accepted") && <button onClick={() => cancelRequestMutation.mutate({ requestId: req.id })} className="rounded-lg bg-[#a93131] px-3 py-1.5 text-[10px] font-bold text-white">Cancel request</button>}
                {req.status === "completed" && <button onClick={() => { setRatingRideId(ride.id); setRatingToUserId(ride.driver_id); }} className="rounded-lg bg-[#F06A3A] px-3 py-1.5 text-[10px] font-bold text-white"><Star className="mr-1 inline h-3 w-3" />Rate driver</button>}
              </div>
            </div>
          </div>)}{(mineQuery.data as any).requested.length === 0 && <div className="col-span-full rounded-[24px] border border-dashed border-[#cbd7cd] bg-[#eef4ec] p-10 text-center"><p className="text-[12px] font-bold text-[#43614d]">No requested rides yet.</p><button onClick={() => nav("find")} className="mt-3 rounded-full bg-[#F06A3A] px-4 py-2 text-[11px] font-bold text-white">Find a ride</button></div>}</div>}

          {/* Rating modal */}
          {ratingRideId !== null && <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40"><div className="mx-4 w-full max-w-[380px] rounded-[24px] bg-[#fffdfa] p-6">
            <h3 className="font-display text-[22px] font-semibold">Rate this ride</h3>
            <div className="mt-4"><StarInput value={ratingValue} onChange={setRatingValue} /></div>
            <textarea value={ratingReview} onChange={e => setRatingReview(e.target.value)} placeholder="Optional review…" rows={3} className="mt-3 w-full rounded-xl border border-[#dfe5df] px-3 py-2 text-[12px] outline-none" />
            <div className="mt-4 flex gap-2">
              <button onClick={() => { setRatingRideId(null); setRatingValue(0); setRatingReview(""); }} className="flex-1 rounded-xl border border-[#dfe5df] py-2.5 text-[11px] font-bold">Cancel</button>
              <button disabled={ratingValue === 0 || !ratingToUserId || submitRatingMutation.isPending} onClick={() => submitRatingMutation.mutate({ rideId: ratingRideId, toUserId: ratingToUserId, rating: ratingValue, review: ratingReview || undefined })} className="flex-1 rounded-xl bg-[#F06A3A] py-2.5 text-[11px] font-bold text-white disabled:opacity-60">{submitRatingMutation.isPending ? "Submitting…" : "Submit"}</button>
            </div>
          </div></div>}
        </>}
      </section>}

      {/* ── PROFILE ── */}
      {view === "profile" && <section className="animate-enter mx-auto max-w-[820px]"><div className="mb-7"><span className="eyebrow">Profile</span><h1 className="mt-2 font-display text-[42px] font-semibold tracking-[-0.06em]">Your ride identity.</h1></div>
        {!isAuthenticated && <AuthForm />}
        {isAuthenticated && profileQuery.isLoading && <LoadingState label="Loading your profile…" />}
        {isAuthenticated && profileQuery.isError && <ErrorState label="We couldn't load your profile." onRetry={() => void profileQuery.refetch()} />}
        {isAuthenticated && profileQuery.isSuccess && <div className="grid gap-6">
          {/* Profile card + form */}
          <div className="grid gap-6 sm:grid-cols-[220px_1fr]">
            <div className="rounded-[25px] bg-[#142633] p-5 text-center text-[#f7f5ef]">
              <div className="mx-auto flex h-24 w-24 items-center justify-center rounded-full border-4 border-[#F06A3A] bg-[#dfeae2] text-2xl font-bold text-[#356344]">{(profileName || user?.user_metadata?.name || user?.email || "G").slice(0, 2).toUpperCase()}</div>
              <h2 className="mt-4 font-display text-[24px] font-semibold tracking-[-0.04em]">{profileName || user?.user_metadata?.name || "RideMate student"}</h2>
              <p className="mt-1 text-[11px] text-[#b4c4b7]">{(profileQuery.data as any)?.college?.name ?? "College not set"}</p>
              
              {/* Dynamic Verification Badge */}
              {(() => {
                const status = ((profileQuery.data as any)?.user?.verification_status ?? "pending").toLowerCase();
                const tone = status === "verified" ? "green" : status === "pending" ? "orange" : "red";
                return (
                  <div className="mt-5 flex justify-center">
                    <StatusPill tone={tone}>
                      <ShieldCheck className="h-3.5 w-3.5" /> {status.toUpperCase()}
                    </StatusPill>
                  </div>
                );
              })()}

              <button onClick={() => void logout()} className="mt-5 flex items-center gap-1.5 mx-auto text-[11px] font-bold text-[#b4c4b7] underline underline-offset-4"><LogOut className="h-3 w-3" />Sign out</button>
              
              <button
                onClick={() => {
                  setShowAdminDevPanel(!showAdminDevPanel);
                }}
                className="mt-3 block mx-auto text-[10px] text-[#718078] hover:text-[#b4c4b7] underline"
              >
                {showAdminDevPanel ? "Hide Admin Review Panel" : "Admin Review Panel"}
              </button>
            </div>
            
            <div className="route-sheet rounded-[25px] border border-[#dfe5df] bg-[#fffdfa] p-5 sm:p-7">
              <div className="flex items-start justify-between"><div><span className="eyebrow">About you</span><h2 className="mt-2 font-display text-[27px] font-semibold tracking-[-0.05em]">Keep your details current.</h2></div><Settings2 className="h-4 w-4 text-[#7b8982]" /></div>
              <div className="mt-6 grid gap-4">
                <label className="field"><span>Name</span><input value={profileName} onChange={(event) => setProfileName(event.target.value)} placeholder="Your full name" /></label>
                <label className="field"><span>Phone Number (for confirmed ride contact)</span><input value={profilePhone} onChange={(event) => setProfilePhone(event.target.value)} placeholder="e.g. +91 9876543210" /></label>
                <label className="field"><span>College</span><select value={(profileQuery.data as any)?.user?.college_id ?? ""} onChange={(event) => updateProfileMutation.mutate({ collegeId: event.target.value ? Number(event.target.value) : null })}><option value="">Choose your college</option>{(collegesQuery.data ?? []).map((college: any) => <option key={college.id} value={college.id}>{college.name}</option>)}</select></label>
                <div className="grid gap-4 sm:grid-cols-2"><label className="field"><span>Course</span><input value={profileCourse} onChange={(event) => setProfileCourse(event.target.value)} placeholder="e.g. BCA" /></label><label className="field"><span>Year / semester</span><input value={profileYear} onChange={(event) => setProfileYear(event.target.value)} placeholder="e.g. Year 2" /></label></div>
              </div>
              <button onClick={() => updateProfileMutation.mutate({ name: profileName, course: profileCourse || null, year: profileYear || null, phoneNumber: profilePhone || null })} disabled={updateProfileMutation.isPending} className="mt-5 w-full rounded-2xl bg-[#142633] py-3.5 text-[12px] font-bold text-white disabled:opacity-60">{updateProfileMutation.isPending ? "Saving…" : "Save profile"}</button>
            </div>
          </div>

          {/* Admin Verification Review Panel */}
          {((profileQuery.data as any)?.user?.role === "admin" || showAdminDevPanel) && (
            <div className="route-sheet rounded-[25px] border border-[#F06A3A]/40 bg-[#fffdfa] p-5 sm:p-7">
              <div className="flex items-start justify-between">
                <div>
                  <span className="eyebrow text-[#F06A3A]">Admin Panel</span>
                  <h2 className="mt-2 font-display text-[27px] font-semibold tracking-[-0.05em]">Student Verification Review</h2>
                </div>
                <ShieldCheck className="h-5 w-5 text-[#F06A3A]" />
              </div>
              <div className="mt-4 grid gap-3">
                {(adminUsersQuery.data ?? []).map((u: any) => (
                  <div key={u.id} className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-[#f1f4ef] p-3 text-[12px]">
                    <div>
                      <div className="font-bold text-[#142633]">{u.name || "Student"} <span className="text-[10px] font-normal text-[#7b8982]">({u.email})</span></div>
                      <div className="text-[10px] text-[#7b8982]">{u.colleges?.name ?? "College not set"} · Status: <span className="font-bold uppercase text-[#142633]">{u.verification_status}</span></div>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <button
                        onClick={() => updateVerificationMutation.mutate({ userId: u.id, status: "verified" })}
                        className="rounded-lg bg-[#356344] px-2.5 py-1 text-[10px] font-bold text-white shadow-xs"
                      >
                        Verify / Approve
                      </button>
                      <button
                        onClick={() => updateVerificationMutation.mutate({ userId: u.id, status: "pending" })}
                        className="rounded-lg bg-[#F06A3A] px-2.5 py-1 text-[10px] font-bold text-white shadow-xs"
                      >
                        Set Pending
                      </button>
                      <button
                        onClick={() => updateVerificationMutation.mutate({ userId: u.id, status: "rejected" })}
                        className="rounded-lg bg-[#a93131] px-2.5 py-1 text-[10px] font-bold text-white shadow-xs"
                      >
                        Reject
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Vehicles section */}
          <div className="route-sheet rounded-[25px] border border-[#dfe5df] bg-[#fffdfa] p-5 sm:p-7">
            <div className="flex items-start justify-between"><div><span className="eyebrow">My vehicles</span><h2 className="mt-2 font-display text-[27px] font-semibold tracking-[-0.05em]">Manage your rides.</h2></div><button onClick={() => setShowAddVehicle(!showAddVehicle)} className="rounded-xl bg-[#F06A3A] px-3 py-2 text-[10px] font-bold text-white"><Plus className="mr-1 inline h-3 w-3" />Add vehicle</button></div>

            {showAddVehicle && <div className="mt-4 rounded-xl border border-[#dfe5df] bg-[#f1f4ef] p-4">
              <div className="grid gap-3 sm:grid-cols-2">
                <label className="field"><span>Type</span><select value={vType} onChange={e => setVType(e.target.value)}><option value="bike">Bike</option><option value="scooter">Scooter</option><option value="car">Car</option></select></label>
                <label className="field"><span>Model</span><input value={vModel} onChange={e => setVModel(e.target.value)} placeholder="e.g. Honda Activa" /></label>
                <label className="field"><span>Last 4 of registration</span><input value={vReg} onChange={e => setVReg(e.target.value)} maxLength={4} placeholder="e.g. 1234" /></label>
                <label className="field"><span>Seat capacity</span><select value={vSeats} onChange={e => setVSeats(e.target.value)}><option value="1">1</option><option value="2">2</option><option value="3">3</option><option value="4">4</option></select></label>
              </div>
              <div className="mt-3 flex gap-2"><button onClick={() => setShowAddVehicle(false)} className="rounded-xl border border-[#dfe5df] px-4 py-2 text-[11px] font-bold">Cancel</button><button disabled={!vModel || addVehicleMutation.isPending} onClick={() => addVehicleMutation.mutate({ type: vType as "bike"|"scooter"|"car", model: vModel, registrationLast4: vReg || undefined, seatCapacity: Number(vSeats) })} className="rounded-xl bg-[#142633] px-4 py-2 text-[11px] font-bold text-white disabled:opacity-60">{addVehicleMutation.isPending ? "Adding…" : "Add"}</button></div>
            </div>}

            <div className="mt-4 grid gap-3">{(vehiclesQuery.data ?? []).map((v: any) => <div key={v.id} className="flex items-center justify-between rounded-xl bg-[#f1f4ef] px-4 py-3">
              <div className="flex items-center gap-3"><div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#dfeae2]">{v.type === "car" ? <CarFront className="h-4 w-4 text-[#356344]" /> : <Bike className="h-4 w-4 text-[#356344]" />}</div><div><div className="text-[12px] font-bold text-[#142633]">{v.model}</div><div className="text-[10px] text-[#7b8982]">{v.type} · {v.seat_capacity} seat{v.seat_capacity > 1 ? "s" : ""}{v.registration_last4 ? ` · •••${v.registration_last4}` : ""}</div></div></div>
              <button onClick={() => deleteVehicleMutation.mutate({ id: v.id })} className="rounded-lg p-2 text-[#a93131] hover:bg-[#fde8e8]"><Trash2 className="h-3.5 w-3.5" /></button>
            </div>)}{(vehiclesQuery.data ?? []).length === 0 && !showAddVehicle && <div className="py-4 text-center text-[11px] text-[#7b8982]">No vehicles added yet</div>}</div>
          </div>
        </div>}
      </section>}
    </main>

    {/* Real-time Chat Modal */}
    {activeChat && (
      <ChatModal
        rideId={activeChat.rideId}
        otherUserId={activeChat.otherUserId}
        otherUserName={activeChat.otherUserName}
        onClose={() => setActiveChat(null)}
      />
    )}

    <nav className="fixed bottom-0 left-0 right-0 z-40 border-t border-[#dfe5df] bg-[#fffdfa]/95 px-3 py-2.5 backdrop-blur-md lg:hidden"><div className="mx-auto flex max-w-[600px] items-center justify-around">{mobileNav("home", House, "Home")}{mobileNav("find", Search, "Find")}{mobileNav("offer", Plus, "Offer")}{mobileNav("rides", Navigation, "Rides")}{mobileNav("profile", UserRound, "Profile")}</div></nav>
  </div>;
}
