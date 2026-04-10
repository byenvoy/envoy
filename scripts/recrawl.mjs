const res = await fetch(process.env.NEXT_PUBLIC_APP_URL + "/api/knowledge-base/recrawl", {
  headers: { Authorization: "Bearer " + process.env.CRON_SECRET },
});
console.log("recrawl:", res.status);
process.exit(res.ok ? 0 : 1);
