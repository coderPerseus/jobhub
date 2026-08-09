"use client";

import { useEffect, useState } from "react";

import { orpc } from "../lib/orpc";

type State =
  | { kind: "loading" }
  | { kind: "ready"; timestamp: string }
  | { kind: "error"; message: string };

export function ApiStatus() {
  const [state, setState] = useState<State>({ kind: "loading" });

  useEffect(() => {
    let active = true;

    void orpc.system.health().then(
      (result) => {
        if (active) {
          setState({ kind: "ready", timestamp: result.timestamp });
        }
      },
      (error: unknown) => {
        if (active) {
          setState({
            kind: "error",
            message: error instanceof Error ? error.message : "无法连接 API",
          });
        }
      },
    );

    return () => {
      active = false;
    };
  }, []);

  return (
    <section className={`status status--${state.kind}`} aria-live="polite">
      <span className="status__dot" aria-hidden="true" />
      <div>
        <strong>
          {state.kind === "loading" && "正在连接 API"}
          {state.kind === "ready" && "API 已连接"}
          {state.kind === "error" && "API 未连接"}
        </strong>
        <small>
          {state.kind === "loading" && "通过 oRPC 读取共享契约"}
          {state.kind === "ready" && new Date(state.timestamp).toLocaleString("zh-CN")}
          {state.kind === "error" && state.message}
        </small>
      </div>
    </section>
  );
}

