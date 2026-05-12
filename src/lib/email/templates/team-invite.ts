type InviteRole = "owner" | "agent";

export function teamInvite({
  inviterFullName,
  inviterEmail,
  orgName,
  role,
  url,
  expiresInDays,
}: {
  inviterFullName: string | null;
  inviterEmail: string;
  orgName: string | null;
  role: InviteRole;
  url: string;
  expiresInDays: number;
}): { subject: string; html: string; text: string } {
  const { displayName, showEmailSubtitle, initials } = resolveInviter({
    fullName: inviterFullName,
    email: inviterEmail,
  });
  const org = orgName ?? "a team";
  const article = role === "owner" ? "an" : "an";
  const subject = `${displayName} invited you to ${org} on Envoy`;

  const displayNameSafe = escapeHtml(displayName);
  const emailSafe = escapeHtml(inviterEmail);
  const orgSafe = escapeHtml(org);
  const initialsSafe = escapeHtml(initials);
  const roleSafe = escapeHtml(role);
  const urlSafe = escapeAttr(url);

  const html = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<meta name="color-scheme" content="light only" />
<meta name="supported-color-schemes" content="light only" />
<title>${escapeHtml(subject)}</title>
<!--[if mso]>
<style type="text/css">body, table, td, a { font-family: Arial, Helvetica, sans-serif !important; }</style>
<![endif]-->
<link rel="preconnect" href="https://fonts.googleapis.com" />
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
<link href="https://fonts.googleapis.com/css2?family=DM+Mono:wght@400;500&family=DM+Sans:wght@500;600;700&family=Instrument+Sans:wght@400;500;600&display=swap" rel="stylesheet" />
<style>
body, table, td, p, a { -webkit-text-size-adjust:100%; -ms-text-size-adjust:100%; }
table, td { mso-table-lspace:0pt; mso-table-rspace:0pt; }
img { -ms-interpolation-mode:bicubic; border:0; outline:none; text-decoration:none; }
body { margin:0; padding:0; width:100% !important; background:#FAF8F5; }
a { color:#2D6A4F; }
@media only screen and (max-width: 600px) {
  .container { width:100% !important; }
  .px { padding-left:24px !important; padding-right:24px !important; }
  .py-lg { padding-top:32px !important; padding-bottom:32px !important; }
  .h1 { font-size:24px !important; line-height:1.25 !important; }
  .btn a { display:block !important; width:100% !important; }
}
</style>
</head>
<body style="margin:0; padding:0; background:#FAF8F5; font-family:'Instrument Sans', -apple-system, BlinkMacSystemFont, 'Segoe UI', Helvetica, Arial, sans-serif; color:#1A1A1A;">
<div style="display:none; max-height:0; overflow:hidden; mso-hide:all; font-size:1px; line-height:1px; color:#FAF8F5;">${displayNameSafe} invited you to ${orgSafe} on Envoy as ${article} ${roleSafe}.</div>
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" bgcolor="#FAF8F5">
<tr><td align="center" style="padding:40px 16px;">
<table role="presentation" class="container" width="560" cellspacing="0" cellpadding="0" border="0" style="max-width:560px; width:100%;">
<tr><td style="padding:0 4px 24px;">
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0"><tr>
<td align="left" style="font-family:'DM Mono', ui-monospace, SFMono-Regular, Menlo, monospace; font-size:13px; letter-spacing:0.18em; text-transform:uppercase; color:#1A1A1A; font-weight:500;">
<span style="display:inline-block; width:8px; height:8px; background:#2D6A4F; border-radius:2px; vertical-align:middle; margin-right:10px;"></span>Envoy
</td>
<td align="right" style="font-family:'DM Mono', ui-monospace, monospace; font-size:11px; color:#6B6560; letter-spacing:0.08em; text-transform:uppercase;">Team invitation</td>
</tr></table>
</td></tr>
<tr><td bgcolor="#FFFFFF" style="background:#FFFFFF; border:1px solid #D4CFC9; border-radius:12px;">
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0">
<tr><td class="px py-lg" style="padding:48px 48px 8px;">
<p style="margin:0 0 6px; font-family:'DM Mono', monospace; font-size:11px; letter-spacing:0.1em; text-transform:uppercase; color:#6B6560;">You've been invited</p>
<h1 class="h1" style="margin:0 0 24px; font-family:'DM Sans', -apple-system, BlinkMacSystemFont, sans-serif; font-weight:700; font-size:28px; line-height:1.2; letter-spacing:-0.02em; color:#1A1A1A;">Join ${orgSafe} on Envoy</h1>
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background:#FAF8F5; border:1px solid #E8E4DF; border-radius:10px; margin-bottom:28px;"><tr>
<td style="padding:18px 20px;">
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0"><tr>
<td valign="middle" width="40" style="padding-right:14px;">
<div style="width:40px; height:40px; background:#1B4332; border-radius:9999px; text-align:center; line-height:40px; font-family:'DM Sans', sans-serif; font-size:15px; font-weight:600; color:#FFFFFF; letter-spacing:0.01em;">${initialsSafe}</div>
</td>
<td valign="middle">
<div style="font-family:'DM Sans', sans-serif; font-size:15px; font-weight:600; color:#1A1A1A; line-height:1.3;">${displayNameSafe}</div>
${showEmailSubtitle ? `<div style="font-family:'DM Mono', monospace; font-size:12px; color:#6B6560; line-height:1.4; margin-top:2px;">${emailSafe}</div>` : ""}
</td>
</tr></table>
</td>
</tr></table>
<p style="margin:0 0 12px; font-size:15px; line-height:1.6; color:#1A1A1A;">
<strong style="font-weight:600;">${displayNameSafe}</strong> invited you to join <strong style="font-weight:600;">${orgSafe}</strong> on Envoy as ${article} <strong style="font-weight:600;">${roleSafe}</strong>.
</p>
</td></tr>
<tr><td class="px" style="padding:16px 48px 8px;">
<table role="presentation" class="btn" cellspacing="0" cellpadding="0" border="0"><tr>
<td bgcolor="#2D6A4F" style="border-radius:8px;">
<!--[if mso]>
<v:roundrect xmlns:v="urn:schemas-microsoft-com:vml" xmlns:w="urn:schemas-microsoft-com:office:word" href="${urlSafe}" style="height:46px; v-text-anchor:middle; width:220px;" arcsize="18%" stroke="f" fillcolor="#2D6A4F">
<w:anchorlock/><center style="color:#ffffff; font-family:Arial, sans-serif; font-size:14px; font-weight:600; letter-spacing:0.01em;">Accept invitation</center>
</v:roundrect>
<![endif]-->
<!--[if !mso]><!-- -->
<a href="${urlSafe}" style="display:inline-block; padding:13px 28px; font-family:'DM Sans', sans-serif; font-size:14px; font-weight:600; color:#FFFFFF; background:#2D6A4F; border-radius:8px; text-decoration:none; letter-spacing:0.01em; line-height:1;">Accept invitation</a>
<!--<![endif]-->
</td>
</tr></table>
</td></tr>
<tr><td class="px" style="padding:20px 48px 32px;">
<p style="margin:0 0 6px; font-size:13px; color:#6B6560;">Or paste this link into your browser:</p>
<p style="margin:0; font-family:'DM Mono', monospace; font-size:12px; line-height:1.5; word-break:break-all;">
<a href="${urlSafe}" style="color:#2D6A4F; text-decoration:none;">${urlSafe}</a>
</p>
</td></tr>
<tr><td class="px" style="padding:0 48px 32px;">
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0"><tr><td style="border-top:1px solid #E8E4DF; height:1px; line-height:1px; font-size:0;">&nbsp;</td></tr></table>
</td></tr>
<tr><td class="px" style="padding:0 48px 40px;">
<p style="margin:0 0 14px; font-family:'DM Mono', monospace; font-size:11px; letter-spacing:0.1em; text-transform:uppercase; color:#6B6560;">As ${article} ${roleSafe} you can</p>
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0">
<tr><td valign="top" style="padding:0 0 10px;">
<table role="presentation" cellspacing="0" cellpadding="0" border="0"><tr>
<td valign="top" width="18" style="padding-right:10px;"><span style="display:inline-block; width:6px; height:6px; background:#2D6A4F; border-radius:9999px; margin-top:8px;"></span></td>
<td valign="top" style="font-size:14px; line-height:1.55; color:#1A1A1A;">Review, edit, and approve drafted replies before they're sent</td>
</tr></table>
</td></tr>
<tr><td valign="top" style="padding:0 0 10px;">
<table role="presentation" cellspacing="0" cellpadding="0" border="0"><tr>
<td valign="top" width="18" style="padding-right:10px;"><span style="display:inline-block; width:6px; height:6px; background:#2D6A4F; border-radius:9999px; margin-top:8px;"></span></td>
<td valign="top" style="font-size:14px; line-height:1.55; color:#1A1A1A;">Create autopilot topics that handle routine questions on their own</td>
</tr></table>
</td></tr>
<tr><td valign="top">
<table role="presentation" cellspacing="0" cellpadding="0" border="0"><tr>
<td valign="top" width="18" style="padding-right:10px;"><span style="display:inline-block; width:6px; height:6px; background:#2D6A4F; border-radius:9999px; margin-top:8px;"></span></td>
<td valign="top" style="font-size:14px; line-height:1.55; color:#1A1A1A;">Curate the shared knowledge base your team replies from</td>
</tr></table>
</td></tr>
</table>
</td></tr>
<tr><td class="px" style="padding:0 48px 40px;">
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0"><tr>
<td valign="top" width="28" style="padding-right:12px;">
<div style="width:28px; height:28px; background:#FDF3E3; border-radius:6px; text-align:center; line-height:28px; font-family:'DM Mono', monospace; font-size:14px; color:#E09F3E; font-weight:600;">!</div>
</td>
<td valign="top">
<p style="margin:0; font-size:13px; line-height:1.55; color:#6B6560;">This invitation expires in <strong style="color:#1A1A1A; font-weight:600;">${expiresInDays} days</strong>. If you weren't expecting this, you can safely ignore the email &mdash; no account will be created.</p>
</td>
</tr></table>
</td></tr>
</table>
</td></tr>
<tr><td style="padding:24px 4px 0;">
<p style="margin:0; font-family:'Instrument Sans', sans-serif; font-size:12px; line-height:1.6; color:#6B6560;">Envoy &middot; Self-hosted AI customer support</p>
</td></tr>
</table>
</td></tr>
</table>
</body>
</html>`;

  const text = `${displayName} invited you to ${org} on Envoy

${displayName} invited you to join ${org} on Envoy as ${article} ${role}.

Accept the invitation: ${url}

As ${article} ${role} you can:
  • Review, edit, and approve drafted replies before they're sent
  • Create autopilot topics that handle routine questions on their own
  • Curate the shared knowledge base your team replies from

This invitation expires in ${expiresInDays} days. If you weren't expecting this, you can safely ignore the email — no account will be created.

— Envoy`;

  return { subject, html, text };
}

function resolveInviter({
  fullName,
  email,
}: {
  fullName: string | null;
  email: string;
}): { displayName: string; showEmailSubtitle: boolean; initials: string } {
  const trimmed = fullName?.trim() ?? "";
  if (trimmed.length > 0) {
    const parts = trimmed.split(/\s+/);
    const initials =
      parts.length >= 2
        ? (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
        : parts[0][0].toUpperCase();
    return { displayName: trimmed, showEmailSubtitle: true, initials };
  }
  return {
    displayName: email,
    showEmailSubtitle: false,
    initials: (email[0] ?? "?").toUpperCase(),
  };
}

function escapeHtml(input: string): string {
  return input
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function escapeAttr(input: string): string {
  return input.replace(/"/g, "&quot;");
}
