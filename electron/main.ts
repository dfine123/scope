import { app, BrowserWindow, ipcMain, shell } from "electron";
import * as path from "node:path";
import * as fs from "node:fs";
import { Database } from "./database";
import { ClaudeService } from "./claude";

const isDev = !app.isPackaged;
let mainWindow: BrowserWindow | null = null;
let db: Database | null = null;
let claude: ClaudeService | null = null;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 820,
    minWidth: 960,
    minHeight: 640,
    backgroundColor: "#050507",
    titleBarStyle: process.platform === "darwin" ? "hiddenInset" : "default",
    frame: process.platform !== "darwin" ? false : undefined,
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
    },
  });

  if (isDev && process.env.VITE_DEV_SERVER_URL) {
    mainWindow.loadURL(process.env.VITE_DEV_SERVER_URL);
    mainWindow.webContents.openDevTools({ mode: "detach" });
  } else {
    mainWindow.loadFile(path.join(__dirname, "../dist/index.html"));
  }

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: "deny" };
  });

  mainWindow.on("closed", () => {
    mainWindow = null;
  });
}

app.whenReady().then(() => {
  const userData = app.getPath("userData");
  if (!fs.existsSync(userData)) fs.mkdirSync(userData, { recursive: true });
  db = new Database(path.join(userData, "scope.db"));
  claude = new ClaudeService(db);

  registerIpc();
  createWindow();

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});

app.on("before-quit", () => {
  db?.close();
});

function registerIpc() {
  ipcMain.handle("db:getCurrentDay", () => db!.getCurrentDay());
  ipcMain.handle("db:listDays", () => db!.listDays());
  ipcMain.handle("db:getDay", (_e, id: string) => db!.getDay(id));
  ipcMain.handle("db:createDay", (_e, payload) => db!.createDay(payload));
  ipcMain.handle("db:updateDay", (_e, id: string, patch) =>
    db!.updateDay(id, patch),
  );
  ipcMain.handle("db:addTask", (_e, dayId: string, task) =>
    db!.addTask(dayId, task),
  );
  ipcMain.handle("db:updateTask", (_e, id: string, patch) =>
    db!.updateTask(id, patch),
  );
  ipcMain.handle("db:deleteTask", (_e, id: string) => db!.deleteTask(id));
  ipcMain.handle("db:reorderTasks", (_e, dayId: string, orderedIds: string[]) =>
    db!.reorderTasks(dayId, orderedIds),
  );
  ipcMain.handle("db:saveReflection", (_e, dayId: string, entries) =>
    db!.saveReflection(dayId, entries),
  );
  ipcMain.handle("db:saveDebrief", (_e, dayId: string, debrief) =>
    db!.saveDebrief(dayId, debrief),
  );
  ipcMain.handle("db:getStreaks", () => db!.getStreaks());
  ipcMain.handle("db:export", () => db!.exportAll());

  ipcMain.handle("ai:parseSchedule", (_e, imageBase64: string) =>
    claude!.parseSchedule(imageBase64),
  );
  ipcMain.handle("ai:generateDebrief", (_e, dayId: string) =>
    claude!.generateDebrief(dayId),
  );
  ipcMain.handle("ai:generateReflectionQuestions", (_e, dayId: string) =>
    claude!.generateReflectionQuestions(dayId),
  );
  ipcMain.handle("ai:generateThinkAbout", (_e, dayId: string) =>
    claude!.generateThinkAbout(dayId),
  );
  ipcMain.handle("ai:mottoAccent", (_e, motto: string) =>
    claude!.mottoAccent(motto),
  );

  ipcMain.handle("app:hasApiKey", () => Boolean(process.env.ANTHROPIC_API_KEY));
}
