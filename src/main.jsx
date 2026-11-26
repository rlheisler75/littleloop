import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App.jsx";
import ErrorBoundary, { reportClientError } from "./components/ErrorBoundary.jsx";

// Errors outside React rendering (event handlers, timers, promises) are recorded too
window.addEventListener("error", e => reportClientError(e.error || e.message, { scope: "window" }));
window.addEventListener("unhandledrejection", e => reportClientError(e.reason, { scope: "promise" }));

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <ErrorBoundary scope="app">
      <App />
    </ErrorBoundary>
  </React.StrictMode>
);
