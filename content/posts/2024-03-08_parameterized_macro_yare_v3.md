+++
title = "What's new in Yare 3.0.0 (A lean parameterized testing macro for Rust)"
date = 2024-03-08

[taxonomies]
tags = ["Rust", "testing", "yare"]
+++

# What is Yare?

[Yare](https://github.com/foresterre/yare) is a lean parameterized testing macro for Rust.

This practically means that when using `#[yare::parameterized]`, it is easier to write a test scenario,
which can be tested against multiple different inputs. Each set of inputs is a separate test case.

For example:

```rust
use yare::parameterized;

#[parameterized(
    apple = { Fruit::Apple, "apple" },
    pear = { Fruit::Pear, "pear" },
    blackberry = { Fruit::Bramble(BrambleFruit::Blackberry), "blackberry" },
)]
fn a_fruity_test(fruit: Fruit, name: &str) {
    assert_eq!(fruit.name_of(), name)
}
```

The above scenario will generate 3 test cases: `apple`, `pear` and `blackberry`, while it was only necessary to specify the 
scenario once. 

As you might imagine, if your add more tests, the removal of duplicated test cases does not only save
writing (and maintenance!) time, but makes it also easier to keep scenarios the same for a large set of inputs (especially
while refactoring code, changes to test scenarios may sneak in, which should also have applied to equivalent inputs). 

# What's new in 3.0.0

## Custom test macro (e.g. tokio::test)

Prior to 3.0.0, Yare would always generate test cases with the Rust built in `#[test]` attribute. While it is exceptionally
useful to have this macro built in, at times you may want to use a different macro because the built-in one doesn't support
a feature you need.

A common example is the `tokio::test` macro, when using the [tokio](https://github.com/tokio-rs/tokio)
asynchronous runtime. While you could create your own [Runtime](https://docs.rs/tokio/latest/tokio/runtime/struct.Runtime.html#method.spawn)
and spawn futures onto this runtime for your test cases, it is perhaps not as elegant as using the [tokio::test](https://docs.rs/tokio/latest/tokio/attr.test.html)
macro.

With this use case in mind, Yare can now be used with user specified test macro's. If none is specified, the Rust built-in
`#[test]` will be used.

**Example**

```rust
use yare::parameterized;

#[parameterized(
    zero_wait = { 0, 0 },
    show_paused = { 500, 0 },
)]
#[test_macro(tokio::test(start_paused = true))]
async fn test(wait: u64, time_elapsed: u128) {
    let start = std::time::Instant::now();
    tokio::time::sleep(tokio::time::Duration::from_millis(wait)).await;

    assert_eq!(time_elapsed, start.elapsed().as_millis());
}

// to use `start_paused = true`, enable the test-util feature for your tokio dependency
// example inspired by: https://tokio.rs/tokio/topics/testing
```

### How does it work?

To make this work, the `#[parameterized(...)]` attribute in Yare parses all attributes placed after it (all attributes must be placed on top of the
test function):

```rust
use syn::parse::{Parse, ParseStream, Result};

enum Attribute {
    /// A regular attribute, which isn't named "test_macro"
    /// NB: Attribute and syn::Attribute are not the same!
    Normal(syn::Attribute),
    // An attribute named "test_macro"
    TestMacro(syn::Meta),
}

pub struct TestFn {
    attributes: Vec<Attribute>,
    fun: syn::ItemFn,
}

impl Parse for TestFn {
    fn parse(input: ParseStream) -> Result<Self> {
        Ok(TestFn {
            attributes: input
                .call(syn::Attribute::parse_outer)?
                .into_iter()
                .map(|attr| {
                    if attr.path().is_ident("test_macro") {
                        attr.parse_args::<syn::Meta>().map(Attribute::TestMacro)
                    } else {
                        Ok(Attribute::Normal(attr))
                    }
                })
                .collect::<Result<Vec<_>>>()?,
            fun: input.parse()?,
        })
    }
}
```

So for the following Rust source code:

```rust
#[parameterized(
    red = { FunctionColor::Red },
    blue = { FunctionColor::Blue },
)]
#[test_macro(function_color::test_macro)]
#[should_panic]
fn test(color: FunctionColor) {
    // ...
}
```

We end up with 1 test_macro attribute and 1 "normal" attribute (i.e. not test_macro):

```rust
vec![
    Attribute::TestMacro(syn::Meta::parse("test_macro(function_color::test_macro)")), // hypothetically, if a &str would be a syn::ParseStream
    Attribute::Normal(syn::Attribute::parse("#[should_panic]")),
];
```

In the code generation phase, we can obtain these separately from `TestFn`:

```rust
impl TestFn {
    pub fn attributes(&self) -> Vec<syn::Attribute> {
        self
            .attributes
            .iter()
            .filter_map(Attribute::to_normal)
            .collect()
    }

    pub fn test_macro_attribute(&self) -> syn::Meta {
        self.attributes
            .iter()
            .find_map(Attribute::to_test_macro) // NB: We elsewhere asserted that there's at most one of these. 
            .unwrap_or_else(|| {
                // A definition for the default #[test] macro
                syn::Meta::Path(syn::Path::from(syn::Ident::new(
                    "test",
                    proc_macro2::Span::call_site(),
                )))
            })
    }
}
```

And finally during generation itself:

```rust
impl TestCase {
    pub fn to_token_stream(&self, test_fn: &TestFn) -> Result<proc_macro2::TokenStream> {
        let test_meta = test_fn.test_macro_attribute();
        let attributes = test_fn.attributes();
        // Many other things omitted...
        
        Ok(quote::quote! {
            #[#test_meta]   // <-- Our custom macro attribute, or #[test] if none was specified
            #(#attributes)* // <-- The "normal" attributes, reproduced
            #visibility #constness #asyncness #unsafety #abi fn #identifier() #return_type {
                #bindings
                #body
            }
        })
    }
}
```

When the code generation phase of the macro has been completed, the parameterized test function will have been substituted by two separate test functions:

```rust
#[function_color::test_macro]
#[should_panic]
fn red() {
    // ...
}

#[function_color::test_macro]
#[should_panic]
fn blue() {
    // ...
}
```

### Gotchas to be aware of

**The `#[test_macro(...)]` attribute must be placed after `#[parameterized]`** 

Like all macro's, `yare::parameterized` can only parse the available scope. Since `yare::parameterized` is supposed
to be placed on top of functions, we can access our own attribute (which we use to parse the test case identifier and arguments for test cases)
and the function underneath (used to specify the parameters and test scenario in the function body).

While `yare::parameterized` does have access to attributes placed after it, the ones which come before it, are inaccessible.

Subsequently, `yare::parameterized` can only recognize placements of `#[test_macro(...)]` which come after it.

So, the following is ok:

```rust
use yare::parameterized;

#[parameterized(
    wow = { "wow!" },
    whew = { "whew!" },
)]
#[test_macro(tokio::test)]
async fn test(sample: &str) {
    // ...
}
```

While this doesn't work:

```rust
use yare::parameterized;

#[test_macro(tokio::test)]
#[parameterized(
    wow = { "wow!" },
    whew = { "whew!" },
)]
async fn test(sample: &str) {
    // ...
}
```

**One `#[test_macro(...)]` per parameterized test function**

Yare currently accepts one `#[test_macro(...)]` for a parameterized test function. The following is not allowed and will return an error:

```rust
use yare::parameterized;

#[parameterized(
    wow = { "wow!" },
    whew = { "whew!" },
)]
#[test_macro(tokio::test)]
#[test_macro(tokio::test(start_paused = true))]
async fn test(sample: &str) {
    // ...
}
```

Returned error:

```
error: Expected at most 1 #[test_macro(...)] attribute, but 2 were given
--> tests/fail/multiple_test_macro_attributes.rs:8:14
  |
8 | #[test_macro(tokio::test(start_paused = true))]
  |              ^^^^^
```

The reason is that it's unclear what should happen when multiple `#[test_macro(...)]` attributes are present.
Should the first one be used by  `#[parameterized(...)]`, and subsequent be left in place? Or would that just be
confusing, if only because the test author will need to keep track of which macro uses which attributes.

**Renaming attributes**

Yare's parameterized attribute can be used with a different name if you would like, by rebinding the target import
part under a local name:

```rust
use yare::parameterized as test_macro_for_twitchcraft_and_lizardry; // <-- Rebinding!

#[test_macro_for_twitchcraft_and_lizardry(                             <-- Usage
    gryffinroar = { "Gryffinroar" },
    hufflefluff = { "Hufflefluff" },
    ravenpaw = { "Ravenpaw" },
    slytherfin = { "Slytherfin" },
)]
fn houses(name: &str) {
    // ...
}
```

However, since the `#[test_macro(...)]` is parsed by `yare::parameterized`, it cannot be renamed.

## Extended function qualifier support

Previously, when Yare was still written to support mostly just the built-in `#[test]` macro, it wasn't so useful to
support the function qualifiers: `const`, `async`, `unsafe` and `extern`. Firstly, because half of these aren't even
supported by `#[test]`. For the ones that are, namely `const` and `extern`, the I deemed the usefulness to be limited.
For example: with `const` you can't use the commonly used `assert_eq!` since the `PartialEq` trait is not marked as `const`. And regarding `extern`, I've never seen anyone call unit test functions over FFI (but if you do, I would like to know, it does sound fun 😅).

However, with custom test macro's, you want at least support for `async` and maybe for `unsafe`. Adding the other two is hardly more work, so I also added `const` and `extern` for completeness.

NB: when specifying one ore more qualifiers in the function definition of your test function, the underlying test macro (whether `#[test]` or a custom macro `#[test_macro(x)]`) must also support the specified qualifiers.

**Example**

```rust
use yare::parameterized;

// NB: The underlying test macro also must support these qualifiers. For example, the default `#[test]` doesn't support async and unsafe.

#[parameterized(
    purple = { &[128, 0, 128] },
    orange = { &[255, 127, 0] },
)]
const extern "C" fn has_reds(streamed_color: &[u8]) {
    assert!(streamed_color.first().is_some());
}
```


# Ideas, feedback and bug reports for Yare

Ideas, feedback and bug reports are most welcome. Feel free to open an issue on [GitHub](https://github.com/foresterre/yare/issues).

# Discuss this post

Discuss on [Reddit](https://reddit.com/r/rust/comments/1b9ijs6/yare_v300_a_lean_parameterized_testing_macro_for/).
