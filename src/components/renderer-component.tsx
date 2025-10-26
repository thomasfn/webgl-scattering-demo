"use client";

import { MouseEvent, useEffect, useRef, useState, WheelEvent } from "react";
import { RendererControls } from "./renderer-controls";
import { ConcreteProperties, Property } from "../rendering/external-properties";
import { commonSceneProperties } from "../rendering/scenes";
import { SceneSelector } from "./scene-selector";
import { EnvSelector } from "./env-selector";
import { Spinner } from "./spinner";
import { Renderer } from "../rendering/renderer";

interface RendererState {
  currentSceneIndex: number;
  currentEnvIndex: number;
  currentPropertyDefinitions: Record<string, Property>;
  currentProperties: Record<string, unknown>;
}

export interface RendererComponentProps {
  onError?: (err: string) => void;
}

export default function RendererComponent({ onError }: Readonly<RendererComponentProps>) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const rendererRef = useRef<Renderer | null>(null);
  const [rendererState, setRendererState] = useState<RendererState | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) {
      return;
    }
    let renderer: Renderer;
    try {
      renderer = new Renderer(canvas);
      rendererRef.current = renderer;
      renderer.initRenderer().then(
        () => {
          if (renderer !== rendererRef.current) {
            return;
          }
          setRendererState({
            currentSceneIndex: renderer.currentScene != null ? renderer.scenes.indexOf(renderer.currentScene) : -1,
            currentEnvIndex: renderer.currentEnvName != null ? renderer.envNames.indexOf(renderer.currentEnvName) : -1,
            currentPropertyDefinitions: renderer.currentScene?.getExternalPropertyDefinitions() ?? {},
            currentProperties: renderer.currentScene?.getDefaultExternalProperties() ?? {},
          });
        },
        (err) => {
          if (renderer === rendererRef.current && onError) {
            onError(`${err.stack}`);
          }
        },
      );
    } catch (err) {
      if (onError) {
        onError(`${(err as Error).stack}`);
      }
      return;
    }
    return () => {
      renderer.dispose();
    };
  }, [onError, canvasRef]);

  function onMouseDown(ev: MouseEvent) {
    const renderer = rendererRef.current;
    if (!renderer) {
      return;
    }
    if (ev.button === 0) {
      renderer.onMouseDown();
    }
  }
  function onMouseUp(ev: MouseEvent) {
    const renderer = rendererRef.current;
    if (!renderer) {
      return;
    }
    if (ev.button === 0) {
      renderer.onMouseUp();
    }
  }
  function onMouseMove(ev: MouseEvent) {
    const renderer = rendererRef.current;
    if (!renderer) {
      return;
    }
    renderer.onMouseMove(ev.movementX, ev.movementY);
  }
  function onWheel(ev: WheelEvent) {
    const renderer = rendererRef.current;
    if (!renderer) {
      return;
    }
    renderer.onMouseWheel(ev.deltaY);
  }
  function onPropertiesChanged(newProperties: Record<string, unknown>) {
    if (rendererState == null) {
      return;
    }
    setRendererState({
      ...rendererState,
      currentProperties: newProperties,
    });
    const renderer = rendererRef.current;
    if (!renderer) {
      return;
    }
    renderer.currentScene?.updateExternalProperties(newProperties as ConcreteProperties<typeof commonSceneProperties>);
  }
  function onSceneSelected(newSceneIndex: number) {
    const renderer = rendererRef.current;
    if (!renderer) {
      return;
    }
    renderer.selectScene(newSceneIndex);
    setRendererState({
      ...rendererState!,
      currentSceneIndex: renderer.currentScene != null ? renderer.scenes.indexOf(renderer.currentScene) : -1,
      currentPropertyDefinitions: renderer.currentScene?.getExternalPropertyDefinitions() ?? {},
      currentProperties: renderer.currentScene?.getDefaultExternalProperties() ?? {},
    });
  }
  function onEnvSelected(newEnvIndex: number) {
    const renderer = rendererRef.current;
    if (!renderer) {
      return;
    }
    renderer.selectEnv(renderer.envNames[newEnvIndex]);
    setRendererState({
      ...rendererState!,
      currentEnvIndex: newEnvIndex,
    });
  }

  return (
    <div className="flex flex-col p-4 h-full w-full justify-center relative">
      {!rendererState ? (
        <div className="absolute flex flex-row justify-center left-0 right-0 z-1">
          <Spinner />
        </div>
      ) : undefined}
      <div className="flex flex-row">
        <div className="w-120 flex flex-col justify-center">
          {rendererState ? (
            <>
              <SceneSelector
                scenes={rendererRef.current!.scenes}
                currentSceneIndex={rendererState.currentSceneIndex}
                onSceneSelected={onSceneSelected}
              />
              <EnvSelector
                envNames={rendererRef.current!.envNames}
                currentEnvIndex={rendererState.currentEnvIndex}
                onEnvSelected={onEnvSelected}
              />
              <RendererControls
                propertiesDefinitions={rendererState.currentPropertyDefinitions}
                properties={rendererState.currentProperties}
                onPropertiesChanged={onPropertiesChanged}
              />
            </>
          ) : undefined}
        </div>
        <div className="flex flex-col justify-center relative">
          {rendererState ? (
            <>
              <span className="text-center">Drag the viewport to rotate the camera</span>
              <span className="text-center">Use the mousewheel to zoom in and out</span>
            </>
          ) : undefined}
          <canvas
            className="aspect-square object-contain w-full h-auto"
            width={1024}
            height={1024}
            ref={canvasRef}
            onMouseDown={onMouseDown}
            onMouseMove={onMouseMove}
            onMouseUp={onMouseUp}
            onWheel={onWheel}
          />
        </div>
      </div>
    </div>
  );
}
