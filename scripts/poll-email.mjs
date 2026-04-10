const res = await fetch(process.env.NEXT_PUBLIC_APP_URL + "/api/email/poll", {
  headers: { Authorization: "Bearer " + process.env.CRON_SECRET },
});
console.log("poll:", res.status);
process.exit(res.ok ? 0 : 1);
