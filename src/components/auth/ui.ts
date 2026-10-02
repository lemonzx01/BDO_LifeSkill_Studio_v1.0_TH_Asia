import { btn } from "../ui/button";
import { fieldCls } from "../ui/field";

// kept for the auth forms; the looks come from the shared helpers in components/ui
// (messages use <Notice> from components/ui/Notice)
export const inputCls = fieldCls();
export const labelCls = "flex flex-col gap-1 text-xs text-muted";
export const primaryBtn = btn("primary");
export const secondaryBtn = btn("secondary");
