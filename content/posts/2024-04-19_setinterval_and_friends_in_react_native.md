+++
title = "A tale of setInterval and useEffect in React Native"
date = 2024-04-19

[taxonomies]
tags = ["react-native", "javascript", "typescript"]
+++

At work, I've been building a new [React Native](https://reactnative.dev) app.  Initially, I wanted this app to be as simple
as possible, to allow quick iterative cycles. Although I must admit: I briefly considered to use [React Query](https://tanstack.com/query/v3/docs/framework/react/react-native),
but it wasn't quite time for that yet. Simple first. Complex later.

Now this app needs to refetch a certain resource from the server in regular intervals. I looked at the React Native
docs in an attempt for figure out what the canonical way of doing this was. The docs told me: "hey, you can use
the `Timers` module which contains `setInterval` and `clearInterval`". Just what I needed!

`setInterval` executes a callback after a given milliseconds delay. It doesn't have the option to
immediately fire, however. Luckily it's not hard to work around this: for example by
just executing the function provided in the callback first.

As an alternative, [MDN](https://developer.mozilla.org/en-US/docs/Web/API/setInterval#ensure_that_execution_duration_is_shorter_than_interval_frequency) 
suggested that you could also use `setTimeout`, although in my case, the execution duration is shorter than the interval
frequency, so I figured everything should be fine 🤞.

To give an idea of what the code looked like:

```typescript
export default function MyComponent(): React.JSX.Element {
    useEffect(() => {
        setInterval(() => void fetchResource());
    }, []);
}

async function fetchResource() {
    try {
        const result = await client.resource.fetch();
        setOk(result);
    } catch (error: unknown) {
        const error = ResourceErrorParser.parseError(error);
        setError(error);
    }
} 
```

Now one of the most useful features of React Native, is its ability to live inspect changes you just made.
Running the [Metro](https://metrobundler.dev) development server in combination with a debug build of the app gives you
live updates out of the box. For me, that's simply running `npm run start` to start Metro and in a second
terminal tab `npm run android` to build a debug build of the app and install it on a device (or emulator).

Now, changes made to components or other code can be updated, and the changes can be observed on the app without
rebuilding. Great!

One day, I was checking the logs in the Metro terminal app, and I there seemed to be a few too many fetches to the backend.
Normally, it should refetch the resource every 10 seconds or so (or immediately after certain actions), now it was
making requests to fetch the resource tens of times per second. Whoops.

So what happened? The callback in `useEffect` was being rerendered after each change in the code. And as a result, the
`setInterval` function was being rerun as well. On repeat. Oops 😅.

Luckily, it can be fixed! As it turns out, `setInterval` can return a clean up function, which runs when the component
unmounts (or when the props get updated and the dependencies provided to the `useEffect` have been changed, or even every rerender
if no dependency array is provided):

```typescript
type Id = ReturnType<typeof setInterval>;

// elsewhere:
export default function OtherComponent(): React.JSX.Element {
    const [refetchId, setRefetchId] = useState<Id | undefined>(undefined);
    
    return <MyComponent id={refreshId} setId={setRefetchId} onClear={() => setRefetchId(undefined)} />;
}
 

export default function MyComponent(props: { id?: Id; setId: (id: Id) => void; onClear: () => void;  }): React.JSX.Element {
    useEffect(() => {
        const id = setInterval(() => void fetchResource());
        props.setId(id);
        
        return () => ({
            if (id) {
                clearInterval(id);        
            }
        });
    }, []);
}
```

Note that the dependency array can be empty, since we only want to disable the fetch task if the component is unmounted.
Otherwise it can just do its thing and fetch the resource at each specific interval. And you know what. That's good
enough for me, ... at least for now.

_Wishlist: I wish there was a way to see all active useIntervals and useTimeouts: if you know a way (without storing the
id with some state management utility): please [let me know]((https://github.com/foresterre/foresterre.github.io/discussions)) 🙏_

_I did end up extending the functionality ever so slightly: I added the option to toggle refreshing altogether and changed when refetches happen,
to reschedule the interval when a manual refresh happened (which happens after certain actions) 😅._

# Feedback & discussion

Feedback is most welcome. Feel free to discuss at [GitHub](https://github.com/foresterre/foresterre.github.io/discussions).
