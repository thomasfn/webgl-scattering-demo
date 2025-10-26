import { ReactNode } from "react";

export interface BasePropertyControlProps {
  name: string;
  children: ReactNode;
  tooltip?: string;
  inline?: boolean;
}

export function BasePropertyControl({ name, children, tooltip, inline = false }: Readonly<BasePropertyControlProps>) {
  return (
    <div className={`flex ${inline ? "flex-row" : "flex-col items-fill"} gap-1${tooltip ? " has-tooltip" : ""}`}>
      {tooltip ? (
        <span className="tooltip rounded shadow-md p-1 bg-gray-100 -translate-y-full pointer-events-none">
          {tooltip}
        </span>
      ) : undefined}
      <label className={inline ? "" : "italic"}>{name}</label>
      {children}
    </div>
  );
}
