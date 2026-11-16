import React from "react";
import ReactDOM from "react-dom/client";
import { App as AntdApp, ConfigProvider } from "antd";
import zhCN from "antd/locale/zh_CN";
import "@xyflow/react/dist/style.css";
import "./index.css";
import App from "./App";
import { blueMapTheme } from "./ui/theme";

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    <ConfigProvider
      theme={blueMapTheme}
      locale={zhCN}
      button={{ autoInsertSpace: false }}
    >
      <AntdApp>
        <App />
      </AntdApp>
    </ConfigProvider>
  </React.StrictMode>,
);
