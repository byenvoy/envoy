export function verifyEmail({ url }: { url: string }): {
  subject: string;
  html: string;
  text: string;
} {
  const subject = "Confirm your email for Envoy";

  const html = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<meta name="color-scheme" content="light only" />
<meta name="supported-color-schemes" content="light only" />
<title>${subject}</title>
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
<div style="display:none; max-height:0; overflow:hidden; mso-hide:all; font-size:1px; line-height:1px; color:#FAF8F5;">Confirm your email to finish setting up Envoy. The link is good for 24 hours.</div>
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" bgcolor="#FAF8F5">
<tr><td align="center" style="padding:40px 16px;">
<table role="presentation" class="container" width="560" cellspacing="0" cellpadding="0" border="0" style="max-width:560px; width:100%;">
<tr><td style="padding:0 4px 24px;">
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0"><tr>
<td align="left" style="font-family:'DM Mono', ui-monospace, SFMono-Regular, Menlo, monospace; font-size:13px; letter-spacing:0.18em; text-transform:uppercase; color:#1A1A1A; font-weight:500;">
<span style="display:inline-block; width:8px; height:8px; background:#2D6A4F; border-radius:2px; vertical-align:middle; margin-right:10px;"></span>Envoy
</td>
<td align="right" style="font-family:'DM Mono', ui-monospace, monospace; font-size:11px; color:#6B6560; letter-spacing:0.08em; text-transform:uppercase;">Account verification</td>
</tr></table>
</td></tr>
<tr><td bgcolor="#FFFFFF" style="background:#FFFFFF; border:1px solid #D4CFC9; border-radius:12px;">
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0">
<tr><td class="px py-lg" style="padding:48px 48px 40px;">
<h1 class="h1" style="margin:0 0 12px; font-family:'DM Sans', -apple-system, BlinkMacSystemFont, sans-serif; font-weight:700; font-size:28px; line-height:1.2; letter-spacing:-0.02em; color:#1A1A1A;">Confirm your email</h1>
<p style="margin:0 0 24px; font-size:15px; line-height:1.6; color:#1A1A1A;">Welcome to Envoy. Click the button below to verify your email and finish setting up your account.</p>
<table role="presentation" class="btn" cellspacing="0" cellpadding="0" border="0" style="margin:8px 0 28px;"><tr>
<td bgcolor="#2D6A4F" style="border-radius:8px;">
<!--[if mso]>
<v:roundrect xmlns:v="urn:schemas-microsoft-com:vml" xmlns:w="urn:schemas-microsoft-com:office:word" href="${url}" style="height:46px; v-text-anchor:middle; width:220px;" arcsize="18%" stroke="f" fillcolor="#2D6A4F">
<w:anchorlock/><center style="color:#ffffff; font-family:Arial, sans-serif; font-size:14px; font-weight:600; letter-spacing:0.01em;">Verify email</center>
</v:roundrect>
<![endif]-->
<!--[if !mso]><!-- -->
<a href="${url}" style="display:inline-block; padding:13px 28px; font-family:'DM Sans', -apple-system, BlinkMacSystemFont, sans-serif; font-size:14px; font-weight:600; color:#FFFFFF; background:#2D6A4F; border-radius:8px; text-decoration:none; letter-spacing:0.01em; line-height:1;">Verify email</a>
<!--<![endif]-->
</td></tr></table>
<p style="margin:0 0 8px; font-size:13px; color:#6B6560;">Or paste this link into your browser:</p>
<p style="margin:0; font-family:'DM Mono', ui-monospace, SFMono-Regular, Menlo, monospace; font-size:12px; line-height:1.5; color:#1A1A1A; word-break:break-all;">
<a href="${url}" style="color:#2D6A4F; text-decoration:none;">${url}</a>
</p>
</td></tr>
<tr><td class="px" style="padding:0 48px 32px;">
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0"><tr><td style="border-top:1px solid #E8E4DF; height:1px; line-height:1px; font-size:0;">&nbsp;</td></tr></table>
</td></tr>
<tr><td class="px" style="padding:0 48px 40px;">
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0"><tr>
<td valign="top" width="28" style="padding-right:12px;">
<div style="width:28px; height:28px; background:#FDF3E3; border-radius:6px; text-align:center; line-height:28px; font-family:'DM Mono', monospace; font-size:14px; color:#E09F3E; font-weight:600;">!</div>
</td>
<td valign="top">
<p style="margin:0; font-size:13px; line-height:1.55; color:#6B6560;">The link is valid for <strong style="color:#1A1A1A; font-weight:600;">24 hours</strong>. If you didn't create an Envoy account, you can safely ignore this email.</p>
</td>
</tr></table>
</td></tr>
</table>
</td></tr>
</table>
</td></tr>
</table>
</body>
</html>`;

  const text = `Confirm your email for Envoy

Welcome to Envoy. Open the link below to verify your email and finish setting up your account.

${url}

The link is valid for 24 hours. If you didn't create an Envoy account, you can safely ignore this email.

— Envoy`;

  return { subject, html, text };
}
