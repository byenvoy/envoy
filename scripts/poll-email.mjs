const res = await fetch(process.env.NEXT_PUBLIC_APP_URL + "/api/email/poll", {
  headers: { Authorization: "Bearer " + process.env.CRON_SECRET },
});
console.log("poll:", res.status);
// 409 = lock conflict (previous poll still running), 524 = timeout — both are OK
process.exit(res.status >= 500 && res.status !== 524 ? 1 : 0);
