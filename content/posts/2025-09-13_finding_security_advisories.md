+++
title = "Where are the security advisories of the recently compromised NPM packages?"
date = 2025-09-13

[taxonomies]
tags = ["security-advisory", "npm"]
+++

Four days ago, [news](https://www.aikido.dev/blog/npm-debug-and-chalk-packages-compromised) came in that several packages on NPM were compromised; later it turned out to that it wasn't just one NPM account that was compromised by the (it seems) the same phishing attack, but multiple. The compromised accounts published new package versions containing malware which intercepted network traffic and replaced crypto wallet addresses with alternative malicious addresses. Various popular packages were affected, such as `chalk` and `debug-js` via [Qix](https://www.npmjs.com/~qix)'s NPM account, and `duckdb` via the [duckdb_admin](https://www.npmjs.com/~duckdb_admin) NPM account. 

The malware and compromised accounts (at least the one's we know of) was fairly quickly detected and actions were taken over the next few days to prevent the malicious NPM packages from being installed by downstream users. Props to all involved in the effort, and the open communication!

## Finding the security advisories

Now yesterday, I wanted to find the security advisories for the affected packages for a report at my day job. This turned out to be not as easy as I expected. Simply searching for, e.g. [chalk](https://github.com/advisories?query=chalk) on the GitHub Advisory Database page gave me four results, [three](https://github.com/prebid/Prebid.js/security/advisories/GHSA-jwq7-6j4r-2f92) [of](https://github.com/advisories/GHSA-m662-56rj-8fmm) [which](https://github.com/advisories/GHSA-w62p-hx95-gf2c) were sort of related, but none of them was the security issue in Chalk itself. I thought for a moment they maybe would have issued only a "top level" kind of advisory linked to e.g. the `debug` package, since that repo was used as a central location to file most of the [responses](https://github.com/debug-js/debug/issues/1005#issuecomment-3266885191), but [no luck](https://github.com/advisories?page=1&query=debug) (this sometimes happens when there is a CVE which links multiple packages, like in the case of the compromised [DuckDB](https://github.com/advisories/GHSA-w62p-hx95-gf2c) packages. Changing the type to [unreviewed](https://github.com/advisories?query=type%3Aunreviewed%20chalk) in case they would be filtered out by default gave even less results (0).

![Result of searching for 'chalk' on GitHub's security advisory page](/img/security-advisories-chalk.png)

Then I tried searching via the repo's themselves, for example [chalk](https://github.com/chalk/chalk/security/advisories) and [debug](https://github.com/debug-js/debug/security/advisories). These seem to be exclusive to information posed by the maintainers, which in this case opted to use different channels as there is nothing there.

However, good news! They do exist! I have no idea how I should have found them without going through GitHub's own [advisory-database](https://github.com/github/advisory-database) repo though, which is not exactly setup to be searched by humans directly. This repo also hosts [these](https://github.com/github/advisory-database/issues/6099) [two](https://github.com/github/advisory-database/issues/6103) related issues, which both contain partial lists with links to the specific advisories.

As examples, here are the advisories for:

1. [chalk](https://github.com/advisories/GHSA-2v46-p5h4-248w), and
2. [debug](https://github.com/advisories/GHSA-8mgj-vmr8-frr6)

If I have to guess, then I would guess the advisories only show up after package maintainers have approved it from a security dashboard; but I am not sure.

Now, another reason why the search may be so difficult, is that there doesn't seem to be a CVE for most packages (I couldn't find one, for example [chalk](https://nvd.nist.gov/vuln/search#/nvd/home?keyword=chalk&resultType=records) again). DuckDB however does have [one](https://nvd.nist.gov/vuln/search#/nvd/home?keyword=duckdb&resultType=records), and prebid-js [has](https://nvd.nist.gov/vuln/detail/CVE-2025-59038) [two](https://nvd.nist.gov/vuln/detail/CVE-2025-59039).

I'm unfamiliar with the process and can see that there are pratical limitations, not only because there are many parties involved and distributed over the world, but also because there are many different places where relevant info is posted, and a reasonable way to link from a root page may not be that obvious.

Still, I feel that the way the information is published, presented and made searchable can be improved, for example by giving maintainers a more central way to publish status updates (i.e. written text) for multiple packages at once.

Next time I would go directly to the `github/advisory-database` repository, as it ~~is unclear to me why some bits of information are not shown from the Advisories page~~. While writing the post I found that GitHub's security advisories [documentation](https://docs.github.com/en/code-security/security-advisories/working-with-global-security-advisories-from-the-github-advisory-database/about-the-github-advisory-database#malware-advisories) are probably hidden under explicit use of the `type:malware` tag by default, because "most of the vulnerabilities cannot be resolved by downstream users". This is, I assume, also why DuckDB's advisory does show up; it is not tagged under malware (but posted to DuckDB's [duckdb-node](https://github.com/duckdb/duckdb-node/security/advisories/GHSA-w62p-hx95-gf2c) repo, and also has a CVE, i.e. CVE-2025-59037).  

I don't know yet whether hiding malware typed advisories by default is a practice I like. I definitely don't like that I this is non-obvious from the advisories page itself.

Still, most of my critique stands: finding the right information fast is difficult, and the way advisories are posted is different per package.

## When NPM deletes packages

The second thing I felt can be improved is the way [npmjs.org] removes affected packages. I consider it a good practice to remove the packages to reduce amount of affected downstream users. However, from the website, it is not clear why the package was removed (or whether it existed ever). 

Take for example [chalk](https://www.npmjs.com/package/chalk?activeTab=versions).

The NPM website currently lists the following version history (I'll only list the last few packages):

```
Version Downloads (Last 7 Days) Published
5.6.2 5,188,950 4 days ago
5.6.0 8,711,608 a month ago
5.5.0 1,769,950 a month ago
5.4.1 12,873,396  9 months ago
5.4.0 64,837  9 months ago
```

NB: It doesn't matter whether you tick the "show deprecated versions" box.

From this page, you have no idea that 5.6.1 was ever published and subsequently removed.

I think it would be an improvement to show the version, and mark it explicitly as "removed", so users are not left guessing. That would help you in your search to find context about why it was removed. More information like related advisories would be a bonus.

Luckily, you will find the reason for the removal reported through the CLI, which is a good thing. However, if you use e.g. renovate bot (the open source version), you could have merged a PR to update the package without ever having installed the package yourself (and subsequently not have seen the notice), perhaps even because the PR was created before the infected package was noticed by anyone. It is that easy to end up with a deployed release affected with malware.

My critiques for both these issues are quite the same: the way information is presented when it is critical is not yet where it could be. Of course there are many vendors which offer scanners for packages and package ecosystems, which maybe offer some central way to access information about the compromise. Still, sometimes you also need more specific or end-use information, if possible from the source. I hope that the future will bring better tooling or presentations to quickly assess vulnerability situations, even before a post-mortem took place.
