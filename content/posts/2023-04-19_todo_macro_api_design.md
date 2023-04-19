+++
title = "Using the todo! macro to prototype your API (draft)"
date = 2023-04-19

[taxonomies]
tags = ["Rust", "macro", "API design"]
+++

Rust is a modern language in many ways. It has many great aspects, some in the language, some in the tooling, and also some in the standard library.
In this post I will discuss a macro, which is part of the standard library, and I have come to use a lot.

Let's sketch a situation. You're designing and implementing a library for some great idea you had. And you would like to design some fluent API, which  this library accessible, if not for others, then most definitely also for yourself.

One way to figure out the design of the library is to write a prototype, and write the bare minimum to block out the the initial concept of the API. 
I hear you think: Rust is not to most convenient prototyping language, because it's quite strict and verbose: we have to satisfy the borrow checker and, in many places Rust requires you to explicitely type your code. And altough I believe both will help you design better code, I can also understand the argument that it reduces the prototyping velocity at least a bit.

Luckily for us, the Rust standard library has a useful tool in its toolbox, to prevent just that from happening: the [todo!]() macro.

Let's look at an example, [imagine](https://github.com/foresterre/rust-releases) we're re-designing a Rust API to fetch Rust releases metadata. 

Let's first prototype a few data structures around the concept of "releases":

```rust
/// A data structure consisting of the set of known Rust releases.  
///  
/// Whether a release is known, and how much information is known
/// about a release, depends on the source used to build up this
/// information.
struct Releases {
    // We divide all releases by platform, so we end up with the
    // set of available toolchains for each platform.
    distributions: HashMap<rust_toolchain::Platform, Release>, 
}

/// A set of releases, for a single platform.
struct Distributions {
    toolchains: BTreeSet<Release>,
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
As an example, we may want to find the most recently released Rust release:

```rust
impl Distributions {
    /// Find the most recent Rust release.
    ///
    /// Returns `None` if no distribution could be found.
    pub fn last(&self) -> Option<&Release> {
        todo!()
    }
}
```

See that `todo!` macro 😃? Instead of providing an actual, or fake, implementation which needs to satisfy the return type of our method, we placed a `todo!` macro in the body.
This allows us to not worry about our implementation just yet, so we can focus on the design of our API instead.


Let's expand our design a bit further and add a few more useful methods:


```rust
impl Releases {
    pub fn from_iter<'i, I: Iterator<Item = &'i (rust_toolchain::Platform, Release)>>(iter: I) -> Self {
        todo!()
    }

    /// Find the release distributions for the given platform
    pub fn find_by_platform<I: IntoIterator<Item = Release>>(&self, platform: rust_toolchain::Platform) -> I {
        todo!()
    }

    /// Find the release distribution(s) which where published on the given date.
    pub fn find_by_date<I: IntoIterator<Item = Release>>(&self, date: rust_toolchain::ReleaseDate) -> I {
        todo!()
    }
}
```

## The case of "impl Trait in return position" 

In the last code snippet, we used a trait bound in our type signature to convey that we want to return some type which implements the `IntoIterator` trait. Instead of using the trait bound syntax, we may be tempted to use the `impl Trait` syntax
instead:

```rust
pub fn find_by_date(&self, date: rust_toolchain::ReleaseDate) -> impl IntoIterator<Item = Release> {
    todo!()
}
```

However, if you go ahead and try to compile the above snippet, you will find that the Rust compiler does not like this 😢:

```rust_errors
error[E0277]: `()` is not an iterator
  --> src/lib.rs:14:71
   |
14 |     pub fn find_by_date(&self, date: rust_toolchain::ReleaseDate) -> impl IntoIterator<Item = Release> {
   |                                                                       ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^ `()` is not an iterator
   |
   = help: the trait `Iterator` is not implemented for `()`
   = note: required for `()` to implement `IntoIterator`

For more information about this error, try `rustc --explain E0277`.
```

As it [turns out](https://github.com/rust-lang/rust/issues/36375#issuecomment-357216289), there is an underlying [issue](https://github.com/rust-lang/rust/issues/36375) where the compiler is unable to figure out what type to use for types which have the never type as their return type and use `-> impl Trait`. Our  `todo!` falls under this category, since it does not return (it [panics](https://doc.rust-lang.org/src/core/macros/mod.rs.html#771-778), so the program is immediately terminated).

I find that typing the trait bound before the function parameters (`fn f<T: Bound>() -> T`) is a bit more disruptive to my prototyping velocity than typing `fn f() -> impl Bound`, but it's not too bad; plus your editor or IDE may be able to help.

## Taking it to the next level

What makes `todo!` so powerful as a prototyping tool, is that we still can make use of Rust's type checking capabilities, 
for the composition and usage of our API. This helps us be much more confident about the program's design. 

When using the `todo!` macro, the compiler knows that we do not need to satisfy our return types (within the method body), as `todo!` itself does not return. However, the return type of these methods will still be checked wherever we use these methods. This allows us to not only define the new API, while leaving the implementation for later, but also write some code on how to use it. This can be useful to explore whether an API is easy to use as a caller.

I like to do this by writing unit tests for my API. This way, you also already have a first test for the API in place, for example:

```rust
#[test]
fn create_releases_instance_from_iter() {
    let input  = &[(rust_toolchain::Platform::host(), Release::new(...))];
    let releases = Releases::from_iter(input.iter());

    let expected = ...;

    assert_eq(releases, expected);
}
```

And if we were not yet sure how to construct an input for our function under test, we can also use the `todo!` macro here:

```rust
#[test]
fn create_releases_instance_from_iter() {
    // We can use todo!() here too!
    //
    // We may not be sure yet how to construct our input.
    // Let's take the design of the API, one step at a time.
    let input  = &[todo!()]; // Running this test will panic here.

    // But we are already past the type checking phase, if it compiles!
    // Let's use those types!
    let releases = Releases::from_iter(input.iter()); 

    let expected = Releases {
        distributions: HashMap::default(),
    };

    assert_eq(releases, expected);
}

```

Alternatively, instead of writing inline unit tests, you could also use [doctests](https://doc.rust-lang.org/rustdoc/write-documentation/documentation-tests.html) for this purpose. <!-- although I think doctests do kill the velocity a bit, as they're peculiar and even when using an IDE, (eg with the # and imports which are scoped differently) -->

## Implementation time!

Eventually, when we're happy with the skeleton of our API, we can proceed and replace each `todo!` macro with a real implementation. Of course, it is not necessary to replace all macros at once. 
Instead we can work on each implementation separately, all while using the power of Rust's type checker to get a boost in confidence that the code will eventually work as we intended.
