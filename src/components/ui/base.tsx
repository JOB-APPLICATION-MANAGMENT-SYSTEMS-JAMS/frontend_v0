"use client";

/**
 * Barrel for the UI primitives (§14.2).
 *
 * The implementations live in one file per family, because a single 360-line
 * `base.tsx` made it impossible to find anything by name:
 *
 *   button.tsx    Button, buttonClass, variants
 *   input.tsx     Input, PasswordInput, Textarea, Select, Label
 *   menu.tsx      Combobox, SegmentedControl
 *   toggle.tsx    Switch, Checkbox
 *   display.tsx   Card, Badge, Chip, IconChip, Stat, Kbd, Skeleton, ProgressBar, Pager, Divider
 *   layout.tsx    PageShell, PageHeader, Section, Toolbar, ToolbarSpacer
 *   text.tsx      Eyebrow, Muted, Num
 *   feedback.tsx  EmptyState, ErrorState, InlineBanner, ConfirmDialog, ToastHost
 *   modal.tsx     Modal, Portal, InfoButton
 *
 * This file keeps the older `components/ui/base` import path working, so the split
 * did not have to touch every import site at once. New code should import from the
 * family file directly; this barrel is a compatibility shim, not the interface.
 */
export { Button, buttonClass, type ButtonSize, type ButtonVariant } from "./button";
export { Input, Label, PasswordInput, Select, Textarea } from "./input";
export { Combobox, SegmentedControl } from "./menu";
export { Checkbox, Switch } from "./toggle";
export { Badge, Card, Chip, Divider, IconChip, Kbd, Pager, ProgressBar, Skeleton, Stat } from "./display";
