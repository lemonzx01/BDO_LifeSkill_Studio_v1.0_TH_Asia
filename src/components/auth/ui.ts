import { btn } from "../ui/button";
import { fieldCls, labelCls as fieldLabelCls } from "../ui/field";

// kept for the auth and admin forms; the looks come from the shared helpers in components/ui
// (messages use <Notice> from components/ui/Notice)
export const inputCls = fieldCls();
export const labelCls = fieldLabelCls;
export const primaryBtn = btn("primary");
export const secondaryBtn = btn("secondary");

/**
 * The one big button of a sign-in style card (AuthCard): sign in, create the admin, the forced
 * password change. Gold is kept for this: it is the card's single action.
 */
export const submitBtn = `${btn("primary", "lg")} w-full`;
/**
 * The save button of a form inside a settings card: full width on phones, its own width from sm up.
 * Secondary, not gold: /account shows two of these cards side by side, and a page has one gold button.
 */
export const saveBtn = `${btn("secondary")} w-full sm:w-auto`;
/**
 * A format hint inside a field's label, e.g. "(อย่างน้อย 8 ตัว)": part of the label's name and
 * something the member needs to fill the field, so it keeps the label's colour and is only lighter
 * in weight.
 */
export const labelHintCls = "font-normal";
