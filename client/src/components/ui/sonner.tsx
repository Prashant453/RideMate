import { useTheme } from "next-themes";
import { Toaster as Sonner, type ToasterProps } from "sonner";

const Toaster = ({ ...props }: ToasterProps) => {
  const { theme = "system" } = useTheme();

  return (
    <Sonner
      theme={theme as ToasterProps["theme"]}
      className="toaster group"
      duration={4000}
      toastOptions={{
        classNames: {
          toast: "group toast group-[.toaster]:bg-[#142633] group-[.toaster]:text-[#f7f5ef] group-[.toaster]:border-[#142633] group-[.toaster]:shadow-2xl z-[9999] rounded-[16px] font-sans",
          description: "group-[.toast]:text-[#b4c4b7] text-[12px]",
          title: "text-[13px] font-bold tracking-tight",
          actionButton: "group-[.toast]:bg-[#F06A3A] group-[.toast]:text-white font-bold rounded-lg",
          cancelButton: "group-[.toast]:bg-[#31546f] group-[.toast]:text-[#f7f5ef] font-bold rounded-lg",
          icon: "group-data-[type=error]:text-[#f87171] group-data-[type=success]:text-[#4ade80] group-data-[type=warning]:text-[#fbbf24] group-data-[type=info]:text-[#60a5fa]",
        },
      }}
      {...props}
    />
  );
};

export { Toaster };
