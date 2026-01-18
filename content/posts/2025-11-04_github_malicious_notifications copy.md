+++
title = "Github's malicious notification problem"
date = 2025-11-04

[taxonomies]
tags = ["github"]
+++

In the past four days or so, I've had notifications popping up for repositories which I didn't subscribe to myself.

At first I thought the notification bubble just wouldn't disappear because of a little bug in [Refined GitHub](https://github.com/refined-github/refined-github), but on closer inspection (and disabling the extension to be sure), it turned out it wasn't so.

This is what it looks like in my notifications list:

![List of unread malicious notifications on GitHub](/img/github_malicious_notifications_unread.png)

And because these notification aren't marked as read, the notification bubble at the top consistently suggests there's something new:

![Notification bubble due to malicious undismissable notifications on GitHub](/img/github_malicious_notifications_icon.png)

I wrote "aren't marked as read", but in reality the right word would be "can't". That is, the first image also shows that once you filter on the repository, while the bubble suggests there is one notification, according to the UI, there is none.

## How

In GitHub you can tag someone by using `@username` syntax, which is useful in good faith situations. I presume spammers created some issues in their repository and started tagging lots of users. 

Presumably the repositories and accounts were removed by GitHub staff as manually navigating to the repository on GitHub, shows 404 pages.

![Removed repositories used by the spammers](/img/github_malicious_notifications_repo_404.png)

I'm sad that the notifications weren't removed too, and we now have to resort to alternative methods to remove the notifications.

... Further searching suggests that this issue was initially [reported](https://github.com/orgs/community/discussions/6874) on 28th of October, 2021, so it isn't a new problem.

## Workarounds

[As](https://github.com/orgs/community/discussions/174283) [it](https://github.com/orgs/community/discussions/178439) turns out, I wasn't quite the only one who was affected by these spammers. In my searching, I found many community threads reporting the same issue, and asking for solutions to remove the "ghost" notifications.

For example, in [this](https://github.com/orgs/community/discussions/174246#discussioncomment-14471133) community thread, someone suggested to mark the notification as _read_ using the GitHub API, which can be done using GitHub's own `gh` CLI tool (replace the `last_read_at` date as required):

```bash
gh api notifications -X PUT -F last_read_at=2025-11-04T00:00:00Z
```

However, you should know that it doesn't quite remove the malicious notifications from your notifications dashboard:

![List of read malicious notifications on GitHub](/img/github_malicious_notifications_read.png)

Apparently, that can be done with the API too. I've adapted the invocation from [this](https://github.com/orgs/community/discussions/178439) thread, to match on the repository owner (instead of the notification subject title), and added a flag to paginate the notifications in case you have more than one page like me:

```bash
gh api notifications\?all=true | jq -r '.[] | select(.repository.owner.login | test("(kamino-network|gitcoincom|ycombiinator|paradigm-notification)"; "i")) | .id' \
| xargs -L1 -I{} gh api --method DELETE \
  -H "Accept: application/vnd.github+json" \
  -H "X-GitHub-Api-Version: 2022-11-28" \
  /notifications/threads/{}
```

Step by step explained in case you too want to adapt the query (I did use the `gh` CLI, but you can send HTTP requests directly too).

First we get all notifications by walking through all pages:

```bash
gh api notifications\?all=true --paginate`
```

Then we use `jq` to query the JSON response from the GitHub API and filter specifically on the spam GitHub account names `kamino-network`, `ycombiinator`, `gitcoincom`, and `paradigm-notification`. Return the `.id` of the notification if it's a match.

```bash
jq -r '.[] | select(.repository.owner.login | test("(kamino-network|ycombiinator|gitcoincom|paradigm-notification)")) | .id'
```

Combined so far with output:

```bash
gh api notifications\?all=true --paginate | jq -r '.[] | select(.repository.owner.login | test("(kamino-network|ycombiinator|gitcoincom|paradigm-notification)")) | .id'

19167019306
19143656043
19133393664
19073885018
```

Now we want to remove each of these notifications. To just remove one we can just substitute one of these id's:

```bash
gh api --method DELETE \
  -H "Accept: application/vnd.github+json" \
  -H "X-GitHub-Api-Version: 2022-11-28" \
  /notifications/threads/19167019306
```

We can use `xargs` to do this for all id's, resulting in the suggested query:

```bash
gh api notifications\?all=true | jq -r '.[] | select(.repository.owner.login | test("(kamino-network|gitcoincom|ycombiinator|paradigm-notification)"; "i")) | .id' \
| xargs -L1 -I{} gh api --method DELETE \
  -H "Accept: application/vnd.github+json" \
  -H "X-GitHub-Api-Version: 2022-11-28" \
  /notifications/threads/{}
```

![List of read malicious notifications on GitHub](/img/github_malicious_notifications_removed.png)

Tada!
