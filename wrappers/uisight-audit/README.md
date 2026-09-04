# uisight-audit

An alias for the `uisight-audit` command in [uisight](https://www.npmjs.com/package/uisight) --
the signed-in audit that walks every role.

```bash
npx -y uisight-audit          # this package
npx -y -p uisight uisight-audit   # the same thing, without it
```

It contains four lines and depends on `uisight`; everything it does happens
there. It exists so the short form works, and so the name cannot be claimed by
someone else and run on the machine of anyone following an old README.

`npx` caches what it installs, so the short form can keep running the version of
`uisight` that was current the first time you used it. `npx -y -p uisight@latest
uisight-audit` always resolves the newest — which is why the MCP registration
command in the docs is written that way.

MIT, same as uisight. Source: https://github.com/sololabstr/uisight
