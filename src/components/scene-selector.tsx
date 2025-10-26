import { MouseEventHandler } from "react";
import { BaseScene } from "../rendering/scenes";
import { ControlPanel } from "./control-panel";

interface SceneButtonProps {
  scene: BaseScene;
  current: boolean;
  onClick: MouseEventHandler;
}

function SceneButton({ scene, current, onClick }: Readonly<SceneButtonProps>) {
  const description = scene.getSceneDescription();
  return (
    <div
      className={`py-1 px-2 ${current ? "bg-sky-400" : "bg-sky-500"} hover:bg-sky-300 rounded-sm shadow-sm cursor-pointer`}
      onClick={onClick}
    >
      {description.name}
    </div>
  );
}

export interface SceneSelectorProps {
  scenes: readonly BaseScene[];
  currentSceneIndex?: number;
  onSceneSelected: (newSceneIndex: number) => void;
}

export function SceneSelector({ scenes, currentSceneIndex, onSceneSelected }: Readonly<SceneSelectorProps>) {
  const currentScene = currentSceneIndex != null ? scenes[currentSceneIndex] : undefined;
  return (
    <ControlPanel title="Scene">
      <div className="flex flex-row p-1 justify-center gap-1">
        {scenes.map((scene, i) => (
          <SceneButton key={i} scene={scene} current={i === currentSceneIndex} onClick={() => onSceneSelected(i)} />
        ))}
      </div>
      {currentScene ? <span>{currentScene.getSceneDescription().description}</span> : undefined}
    </ControlPanel>
  );
}
