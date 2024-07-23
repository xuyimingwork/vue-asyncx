export type StringDefaultWhenEmpty<S extends string, D extends string> = S extends '' ? D : S
