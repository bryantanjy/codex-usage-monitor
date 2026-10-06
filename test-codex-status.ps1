$codexExecutable = 'codex.cmd'
if ($env:OS -ne 'Windows_NT') { $codexExecutable = 'codex' }
& $codexExecutable --version
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
node -e "require('./out/usageClient').readCodexUsage(process.argv[1], 15000).then(u => console.log(JSON.stringify({...u, account: u.account ? '(present)' : undefined}, null, 2))).catch(e => { console.error(e.message); process.exitCode = 1; })" $codexExecutable
exit $LASTEXITCODE
