import { trpc } from "@/lib/trpc";
import { supabase } from "@/lib/supabase";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { httpBatchLink, TRPCClientError } from "@trpc/client";
import { createRoot } from "react-dom/client";
import superjson from "superjson";
import App from "./App";
import "./index.css";

const queryClient = new QueryClient();

queryClient.getQueryCache().subscribe(event => {
  if (event.type === "updated" && event.action.type === "error") {
    const error = event.query.state.error;
    if (error instanceof TRPCClientError) {
      console.error("[API Query Error]", error.message);
    }
  }
});

queryClient.getMutationCache().subscribe(event => {
  if (event.type === "updated" && event.action.type === "error") {
    const error = event.mutation.state.error;
    if (error instanceof TRPCClientError) {
      console.error("[API Mutation Error]", error.message);
    }
  }
});

const serverUrl = import.meta.env.VITE_SERVER_URL || (typeof window !== 'undefined' && window.location.hostname.includes('vercel.app') ? 'https://ridemate-backend-m7ti.onrender.com' : '');

const trpcClient = trpc.createClient({
  links: [
    httpBatchLink({
      url: `${serverUrl}/api/trpc`,
      transformer: superjson,
      async headers() {
        // Send the Supabase JWT as Bearer token for server-side auth
        const { data: { session } } = await supabase.auth.getSession();
        if (session?.access_token) {
          return { Authorization: `Bearer ${session.access_token}` };
        }
        return {};
      },
      fetch(input, init) {
        return globalThis.fetch(input, {
          ...(init ?? {}),
          credentials: "include",
        });
      },
    }),
  ],
});

createRoot(document.getElementById("root")!).render(
  <trpc.Provider client={trpcClient} queryClient={queryClient}>
    <QueryClientProvider client={queryClient}>
      <App />
    </QueryClientProvider>
  </trpc.Provider>
);
