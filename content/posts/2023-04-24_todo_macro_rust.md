+++
title = "Using the todo! macro to prototype your API in Rust"
date = 2023-04-24

[taxonomies]
tags = ["Rust", "macro", "API design"]
+++

Let's sketch a situation. You're designing and implementing a library in Rust, for some great idea you had. And, you aim to create a seamless API that makes this library user-friendly not only for others, but also for yourself.

One way to figure out the design of the library is to write a prototype, and write the bare minimum code to stub out the the initial API. 
I hear you think: Rust is not to most convenient prototyping language, because it's quite strict and verbose: we have to satisfy the borrow checker and, in many places, Rust requires you to explicitely type your code. And altough I believe both will help you design better code, I can also understand the argument that it reduces the prototyping velocity at least a bit.

Luckily for us, the Rust standard library has a useful tool in its toolbox: the [todo!](https://doc.rust-lang.org/std/macro.todo.html) macro.

Let's look at an example. Imagine<sup>1</sup> we're re-designing a Rust API to fetch Rust releases metadata. 

We will first prototype a few data structures around the concept of "releases":

```rust
/// A data structure consisting of the set of known Rust releases.  
///  
/// Whether a release is known, and how much information is known
/// about a release, depends on the source used to build up this
/// information.
struct RustReleases {
    // We divide all releases by platform, so we end up with the
    // set of available toolchains for each platform.
    registry: HashMap<rust_toolchain::Platform, ReleaseRecords>, 
}

/// A set of releases, for a single platform.
struct ReleaseRecords {
    releases: BTreeSet<Release>,
}

/// A single release. 
///
/// In this example, we define a release as a toolchain of a specific
/// version (stable, beta) or date (nightly), and its associated
/// components.
struct Release {
    toolchain: rust_toolchain::Toolchain,
    /// Rustup has the concept of components and extensions.
    /// 
    /// When installing a toolchain, components are installed by default, while extensions are optional components.
    /// In this implementation, they're combined.
    components: Vec<rust_toolchain::Component>,
}
```

Now, let's consider how we want to use the data captured by these data structures.
For example, we may want to find the most recently released Rust release:

```rust
impl ReleaseRecords {
    /// Find the most recent Rust release.
    ///
    /// Returns `None` if no release could be found.
    pub fn last_released(&self) -> Option<&Release> {
        todo!()
    }
}
```

See that `todo!` macro 😃? Instead of providing an actual, or fake, implementation which needs to satisfy the return type of our method, we placed a `todo!` macro in the body.
This allows us to not worry about our implementation just yet, so we can focus on the design of our API instead.

It also accepts the same arguments as [panic!](https://doc.rust-lang.org/std/macro.panic.html), so the following will work as well:

```rust
impl Release {
    pub fn release_date(&self) -> rust_toolchain::ReleaseDate {
        todo!("release date of the toolchain")
    }

    pub fn find_component(&self, name: &str) -> Option<rust_toolchain::Component> {
        todo!("find component with name: '{name}'")
    }
}
```

If we run the `find_component` method, we'll find that it panics the thread, and shows the panic message we provided, prefixed with "not yet implemented":

```text
not yet implemented: find component with name: 'hello-world'
thread 'tests::find_component' panicked at 'not yet implemented: find component with name: 'hello-world'', crates/rust-releases-core/src/lib.rs:77:9
stack backtrace:
   0: std::panicking::begin_panic_handler
             at /rustc/84c898d65adf2f39a5a98507f1fe0ce10a2b8dbc/library/std/src/panicking.rs:579
   1: <snip>
note: Some details are omitted, run with `RUST_BACKTRACE=full` for a verbose backtrace.
```


Under the hood, `todo!` is the same as `panic!`, to which it defers its implementation, but with a clear change of semantics: this bit is not yet implemented, but we'll do so soon. 

## Every rose has its thorn

Let's expand our design and add a few more useful methods:

```rust
impl Release {
    /// Returns an iterator over the components which are installed by default.
    pub fn components(&self) -> impl Iterator<Item = &rust_toolchain::Component> {
        todo!("components installed by default")
    }

    /// Returns an iterator over the components which are optional,
    /// and not installed by default.
    pub fn extensions(&self) -> impl Iterator<Item = &rust_toolchain::Component> {
        todo!("components not installed by default")
    }
}
```

In the above code we defined two methods on `Release`, which both return an iterator of `&rust_toolchain::Component` items.
What happens if we try to compile the code above?:

```rust_errors
error[E0277]: `()` is not an iterator
  --> crates/rust-releases-core/src/lib.rs:80:33
   |
80 |     pub fn components(&self) -> impl Iterator<Item = rust_toolchain::Component> {
   |                                 ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^ `()` is not an iterator
   |
   = help: the trait `Iterator` is not implemented for `()`
```

😢

It [turns out](https://github.com/rust-lang/rust/issues/36375#issuecomment-357216289), there is an [issue](https://github.com/rust-lang/rust/issues/36375) where the compiler is unable to figure out what type to use for types which have the never type as their return type and use `impl Trait` in return position. The  `todo!` macro falls in this category.

None of the options to solve this in a compact way are very satisfying.

One option is to box:

```rust
impl Release {
   pub fn extensions<'this>(
        &'this self,
    ) -> Box<dyn Iterator<Item = &'this rust_toolchain::Component> + 'this> {
        todo!("components not installed by default")
    }
}
```

Another is to return a simple concrete type:

```rust
impl Release {
    pub fn extensions(&self) -> Vec<&Component> {
        todo!("components not installed by default")
    }   
}
```

A third is to use the explicit type in the return type, but this require you to think ahead on which iterator type you will be using, which you probably don't want to worry about (especially if you will be using `impl Iterator` on implementation).

## Taking it to the next level

So far, we saw that `todo!` can be a powerful prototyping tool. If we want to take it to the next level, 
we should start making use of Rust's type checking capabilities for the composition and usage of our API. 
This helps us be much more confident throughout designing of the library. 

As shown before, the compiler knows that we do not need to satisfy our return types (within the method body).
However, the return type of these methods will still be checked wherever we use these methods. 
This allows us to not only define the new API, while leaving the implementation for later but also write some code on how to use it.
This can be particularly useful to explore whether an API is easy to use as a caller.

I like to do this by writing unit tests for my API. If your API is painful to use, you're much more likely to find this out if you had to write
a usage example yourself. Plus, this way you also already have a first test in place. Example:

```rust
#[test]
fn find_component_returns_none_if_release_has_no_components() {
    let channel = rust_toolchain::Channel::Nightly;
    let release_date = rust_toolchain::ReleaseDate::new(2023, 1, 1);
    let platform = rust_toolchain::Platform::host();
    let version = None;

    let toolchain = rust_toolchain::Toolchain::new(channel, release_date, platform, version);

    let release = Release::new(toolchain, vec![]);
    let component = release.find_component("hello");

    assert!(component.is_none());
}
```

And if we were not yet sure how to construct an input for our function under test, we can also use the `todo!` macro here:

```rust
#[test]
fn find_component_returns_none_if_release_has_no_components() {
    // We can use todo!() here too!
    //
    // We may not be sure yet how to construct our input.
    // Let's take the design of the API, one step at a time.
    let toolchain = todo!();
    
    // The code below will be unreachable though!
    let release = Release::new(toolchain, vec![]);
    let component = release.find_component("hello");

    assert!(component.is_none());
}
```

Alternatively, instead of writing inline unit tests, you could also use [doctests](https://doc.rust-lang.org/rustdoc/write-documentation/documentation-tests.html) for this purpose:

```rust
impl Release {
    /// Find a component by its name.
    ///
    /// If the component does not exist for this `Release`,
    /// returns `Option::None`.
    ///
    /// # Example
    ///
    /// ```rust
    /// use rust_releases_core::Release;
    ///
    /// let channel = rust_toolchain::Channel::Nightly;
    /// let release_date = rust_toolchain::ReleaseDate::new(2023, 1, 1);
    /// let platform = rust_toolchain::Platform::host();
    /// let version = None;
    ///
    /// let toolchain = rust_toolchain::Toolchain::new(channel, release_date, platform, version);
    ///
    /// let release = Release::new(toolchain, vec![]);
    /// let component = release.find_component("hello");
    ///
    /// assert!(component.is_none());
    /// ```
    pub fn find_component(&self, name: &str) -> Option<&rust_toolchain::Component> {
        todo!("find component with name: '{name}'")
    }
}
```

## Implementation time!

Once we are satisfied with the basic structure of our API, we can gradually replace each `todo!` macro with an actual implementation. We do not have to replace all the macros simultaneously, so we can focus on one implementation step at a time. Developing a well-designed API requires careful planning and attention to detail. Taking the time to establish a solid foundation will pay off in the long run, as it will result in  more user-friendly and reliably designed API.

# Footnotes

<sup>1</sup> I'm currently working on the next version of [rust-releases](https://github.com/foresterre/rust-releases).

# Thanks!

Special thanks to Chris Langhout, Jean de Leeuw and Martijn Steenbergen for proofreading my blog post; any mistakes are solely mine.

Also many thanks to proudHaskeller on [Reddit](https://old.reddit.com/r/rust/comments/12x1lfd/blog_post_using_the_todo_macro_to_prototype_your/jhhn8na/) for reporting an issue I missed: the type signature I used to deal with the `todo!` and `impl Trait` will never type check with concrete implementations.