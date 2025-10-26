import { ReactNode } from "react";

export interface ControlPanelProps {
  title: string;
  children: ReactNode;
}

export function ControlPanel({ title, children }: Readonly<ControlPanelProps>) {
  return (
    <div className="relative p-2">
      <span className="absolute bg-white px-1 mx-3">{title}</span>
      <div className="border border-slate-500/50 rounded-md shadow-lg px-1 py-2 mt-3">
        <div className="flex flex-col items-stretch gap-2 p-2">{children}</div>
      </div>
    </div>
  );
}
