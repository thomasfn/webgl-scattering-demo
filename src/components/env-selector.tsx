import { MouseEventHandler } from "react";
import { ControlPanel } from "./control-panel";

interface EnvButtonProps {
  envName: string;
  current: boolean;
  onClick: MouseEventHandler;
}

function EnvButton({ envName, current, onClick }: Readonly<EnvButtonProps>) {
  return (
    <div
      className={`py-1 px-2 ${current ? "bg-sky-400" : "bg-sky-500"} hover:bg-sky-300 rounded-sm shadow-sm cursor-pointer`}
      onClick={onClick}
    >
      {envName}
    </div>
  );
}

export interface EnvSelectorProps {
  envNames: readonly string[];
  currentEnvIndex?: number;
  onEnvSelected: (newEnvIndex: number) => void;
}

export function EnvSelector({ envNames, currentEnvIndex, onEnvSelected }: Readonly<EnvSelectorProps>) {
  return (
    <ControlPanel title="Environment">
      <div className="flex flex-row p-1 justify-center gap-1">
        {envNames.map((envName, i) => (
          <EnvButton key={i} envName={envName} current={i === currentEnvIndex} onClick={() => onEnvSelected(i)} />
        ))}
      </div>
    </ControlPanel>
  );
}
