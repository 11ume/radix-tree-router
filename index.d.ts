
type Params = {
    [key: string]: string
};

type Handler = (...args: any[]) => any;
type Lookup = (method: string, path: string) => Found | null;
type Create = (method: string, path: string, ...handler: Handler[]) => Found | null;

export type Matcher = {
    lookup: Lookup
    , create: Create
};

export type Found = {
    handler: Handler | null
    , handlers: Handler[] | null
    , params: Params
};

declare function matcher(maxParamLength?: number): Matcher;
export = matcher;