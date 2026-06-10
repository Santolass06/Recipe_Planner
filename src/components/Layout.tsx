import Sidebar from "./Sidebar";
import { type ReactNode } from "react";

export default function Layout({ children }: { children: ReactNode }) {
  return (
    <div className="app">
      <Sidebar />
      <main className="main">{children}</main>
    </div>
  );
}
