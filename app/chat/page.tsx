import React from "react";
import { ChatContainer } from "@/components/chat/ChatContainer";

export const metadata = {
  title: "AI Chat — Babata Lens",
};

export default function ChatPage() {
  return (
    <div className="h-[calc(100vh-3.5rem)] flex flex-col">
      <ChatContainer />
    </div>
  );
}
