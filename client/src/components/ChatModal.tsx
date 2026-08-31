import React, { useEffect, useRef, useState } from "react";
import { Send, X, MessageSquare, Phone, Mail } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { supabase } from "@/lib/supabase";
import { toast } from "sonner";

export type ChatModalProps = {
  rideId: number;
  otherUserId: string;
  otherUserName: string;
  onClose: () => void;
};

export function ChatModal({ rideId, otherUserId, otherUserName, onClose }: ChatModalProps) {
  const [inputText, setInputText] = useState("");
  const [showContactInfo, setShowContactInfo] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Queries & Mutations
  const historyQuery = trpc.chat.history.useQuery({ rideId, otherUserId }, { refetchOnWindowFocus: false });
  const contactQuery = trpc.rides.getContactInfo.useQuery(
    { rideId, targetUserId: otherUserId },
    { enabled: showContactInfo }
  );
  const sendMutation = trpc.chat.send.useMutation({
    onSuccess: () => {
      setInputText("");
      historyQuery.refetch();
    },
    onError: (err) => {
      toast.error(err.message || "Could not send message");
    },
  });

  const meQuery = trpc.auth.me.useQuery();
  const currentUserId = meQuery.data?.id;

  // Supabase Realtime Subscription
  useEffect(() => {
    const channel = supabase
      .channel(`chat_${rideId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "chat_messages",
          filter: `ride_id=eq.${rideId}`,
        },
        () => {
          historyQuery.refetch();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [rideId]);

  // Auto-scroll on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [historyQuery.data]);

  const handleSend = () => {
    if (!inputText.trim()) return;
    sendMutation.mutate({
      rideId,
      receiverId: otherUserId,
      message: inputText.trim(),
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-xs animate-enter">
      <div className="flex h-[520px] w-full max-w-[440px] flex-col rounded-[24px] border border-[#dfe5df] bg-[#fffdfa] shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-[#edf0eb] bg-[#f7f5ef] px-5 py-3.5">
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-[#356344] text-xs font-bold text-white">
              {otherUserName.slice(0, 2).toUpperCase()}
            </div>
            <div>
              <h3 className="text-[13px] font-bold text-[#142633]">{otherUserName}</h3>
              <span className="text-[10px] text-[#356344] font-semibold">● Confirmed Ride Partner</span>
            </div>
          </div>
          <div className="flex items-center gap-1.5">
            <button
              onClick={() => setShowContactInfo(!showContactInfo)}
              title="Show contact details"
              className="flex h-8 w-8 items-center justify-center rounded-full bg-[#fffdfa] border border-[#dfe5df] text-[#52645b] hover:bg-[#eef4ec] transition"
            >
              <Phone className="h-3.5 w-3.5 text-[#F06A3A]" />
            </button>
            <button
              onClick={onClose}
              className="flex h-8 w-8 items-center justify-center rounded-full text-[#7b8982] hover:bg-[#eef4ec]"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* Contact Info Overlay */}
        {showContactInfo && (
          <div className="border-b border-[#dfe5df] bg-[#fff0e7] px-5 py-3 text-[11px]">
            <div className="flex items-center justify-between font-bold text-[#142633] mb-1">
              <span>Contact Information</span>
              <button onClick={() => setShowContactInfo(false)} className="text-[10px] text-[#b64f2d] underline">
                Hide
              </button>
            </div>
            {contactQuery.isLoading && <span className="text-[#7b8982]">Loading contact info…</span>}
            {contactQuery.data && (
              <div className="space-y-1 text-[#30433e]">
                {contactQuery.data.phone_number ? (
                  <div className="flex items-center gap-2 font-bold text-[#F06A3A]">
                    <Phone className="h-3 w-3" />
                    <a href={`tel:${contactQuery.data.phone_number}`} className="underline">
                      {contactQuery.data.phone_number}
                    </a>
                  </div>
                ) : (
                  <div className="text-[#7b8982] italic">No phone number added to profile</div>
                )}
                {contactQuery.data.email && (
                  <div className="flex items-center gap-2 text-[10px] text-[#718078]">
                    <Mail className="h-3 w-3" />
                    <span>{contactQuery.data.email}</span>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* Messages Body */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-[#fbfdfa]">
          {historyQuery.isLoading && (
            <div className="py-8 text-center text-[11px] text-[#7b8982]">Loading messages…</div>
          )}
          {historyQuery.isSuccess && historyQuery.data.length === 0 && (
            <div className="py-12 text-center text-[#7b8982]">
              <MessageSquare className="mx-auto h-8 w-8 text-[#cbd7cd] mb-2" />
              <p className="text-[12px] font-bold text-[#43614d]">Ride Chat</p>
              <p className="text-[10px] mt-0.5">Coordinate pickup location or route details.</p>
            </div>
          )}
          {historyQuery.data?.map((msg: any) => {
            const isMe = msg.sender_id === currentUserId;
            return (
              <div key={msg.id} className={`flex flex-col ${isMe ? "items-end" : "items-start"}`}>
                <div
                  className={`max-w-[80%] rounded-2xl px-3.5 py-2 text-[12px] ${
                    isMe
                      ? "bg-[#142633] text-white rounded-br-xs"
                      : "bg-[#eef4ec] text-[#142633] border border-[#dfe5df] rounded-bl-xs"
                  }`}
                >
                  {msg.message}
                </div>
                <span className="mt-1 px-1 text-[9px] text-[#96a49a]">
                  {new Date(msg.created_at).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}
                </span>
              </div>
            );
          })}
          <div ref={messagesEndRef} />
        </div>

        {/* Input Bar */}
        <div className="border-t border-[#edf0eb] bg-[#fffdfa] p-3">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleSend();
            }}
            className="flex items-center gap-2"
          >
            <input
              type="text"
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              placeholder="Type a message…"
              className="flex-1 rounded-xl border border-[#dfe5df] bg-[#f8faf7] px-3.5 py-2.5 text-[12px] text-[#142633] outline-none focus:border-[#F06A3A]"
            />
            <button
              type="submit"
              disabled={!inputText.trim() || sendMutation.isPending}
              className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#F06A3A] text-white disabled:opacity-50 hover:bg-[#d85d31] transition"
            >
              <Send className="h-4 w-4" />
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
