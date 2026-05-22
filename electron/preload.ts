import { contextBridge, ipcRenderer } from "electron";

const api = {
  db: {
    getCurrentDay: () => ipcRenderer.invoke("db:getCurrentDay"),
    listDays: () => ipcRenderer.invoke("db:listDays"),
    getDay: (id: string) => ipcRenderer.invoke("db:getDay", id),
    createDay: (payload: any) => ipcRenderer.invoke("db:createDay", payload),
    updateDay: (id: string, patch: any) =>
      ipcRenderer.invoke("db:updateDay", id, patch),
    addTask: (dayId: string, task: any) =>
      ipcRenderer.invoke("db:addTask", dayId, task),
    updateTask: (id: string, patch: any) =>
      ipcRenderer.invoke("db:updateTask", id, patch),
    deleteTask: (id: string) => ipcRenderer.invoke("db:deleteTask", id),
    reorderTasks: (dayId: string, orderedIds: string[]) =>
      ipcRenderer.invoke("db:reorderTasks", dayId, orderedIds),
    saveReflection: (dayId: string, entries: any) =>
      ipcRenderer.invoke("db:saveReflection", dayId, entries),
    saveDebrief: (dayId: string, debrief: any) =>
      ipcRenderer.invoke("db:saveDebrief", dayId, debrief),
    getStreaks: () => ipcRenderer.invoke("db:getStreaks"),
    exportAll: () => ipcRenderer.invoke("db:export"),
  },
  ai: {
    parseSchedule: (imageBase64: string) =>
      ipcRenderer.invoke("ai:parseSchedule", imageBase64),
    generateDebrief: (dayId: string) =>
      ipcRenderer.invoke("ai:generateDebrief", dayId),
    generateReflectionQuestions: (dayId: string) =>
      ipcRenderer.invoke("ai:generateReflectionQuestions", dayId),
    generateThinkAbout: (dayId: string) =>
      ipcRenderer.invoke("ai:generateThinkAbout", dayId),
    mottoAccent: (motto: string) =>
      ipcRenderer.invoke("ai:mottoAccent", motto),
  },
  app: {
    hasApiKey: () => ipcRenderer.invoke("app:hasApiKey"),
  },
};

contextBridge.exposeInMainWorld("scope", api);

export type ScopeAPI = typeof api;
