const { Node, NODE_TYPE } = require('./node.js')
const { sanitizeUrl } = require('./utils.js')

/*
    char codes
    '#': 35
    '*': 42
    '-': 45
    '/': 47
    ':': 58
    ';': 59
    '?': 63
*/

const getWildcardNode = (node, path, len) => {
    if (node === null) {
        return null
    }

    const param = path.slice(-len)
    if (param === null) {
        return null
    }

    const handle = node.handler
    if (handle !== null && handle !== undefined) {
        return {
            handler: handle.handler
            , params: {
                '*': param
            }
        }
    }

    return null
}

const insertNode = ({
    trees
    , type
    , path
    , params
    , method
    , handler
}) => {
    let pathIn = path
    let len = 0
    let max = 0
    let node = null
    let prefix = ''
    let pathLen = 0
    let prefixLen = 0
    let currentNode = trees[method]

    if (typeof currentNode === 'undefined') {
        currentNode = new Node()
        trees[method] = currentNode
    }

    while (true) {
        len = 0
        prefix = currentNode.prefix
        pathLen = pathIn.length
        prefixLen = prefix.length

        // search for the longest common prefix
        max = pathLen < prefixLen ? pathLen : prefixLen
        while (len < max && pathIn[len] === prefix[len]) {
            len++
        }

        // the longest common prefix is smaller than the current prefix
        // let's split the node and add a new child
        if (len < prefixLen) {
            node = new Node({
                prefix: prefix.slice(len)
                , children: currentNode.children
                , type: currentNode.type
                , handler: currentNode.handler
            })

            if (currentNode.wildcardChild !== null) {
                node.wildcardChild = currentNode.wildcardChild
            }

            // reset the parent
            currentNode
                .reset(prefix.slice(0, len))
                .addChild(node)

            // if the longest common prefix has the same length of the current path
            // the handler should be added to the current node, to a child otherwise
            if (len === pathLen) {
                currentNode.setHandler(handler, params)
                currentNode.type = type
            } else {
                node = new Node({
                    prefix: pathIn.slice(len)
                    , type
                })

                node.setHandler(handler, params)
                currentNode.addChild(node)
            }

            // the longest common prefix is smaller than the path length,
            // but is higher than the prefix
        } else if (len < pathLen) {
            // remove the prefix
            pathIn = pathIn.slice(len)
            // check if there is a child with the label extracted from the new path
            node = currentNode.findByLabel(pathIn)
            // there is a child within the given label, we must go deepen in the tree
            if (node) {
                currentNode = node
                continue
            }

            // there are not children within the given label, let's create a new one!
            node = new Node({
                type
                , prefix: pathIn
            })

            node.setHandler(handler, params)
            currentNode.addChild(node)
        } else if (handler) {
            currentNode.setHandler(handler, params)
        }

        return
    }
}

// destructure path and make an node trees classification
const prepareNodes = (trees, method, inPath, handler) => {
    let path = inPath
    const params = []

    for (let i = 0, jump, len = path.length; i < len; i++) {
        // parametric node
        if (path[i] === ':') {
            const nodeType = NODE_TYPE.PARAM
            jump = i + 1
            let staticPart = path.slice(0, i)

            // add the static part of the route to the tree
            insertNode({
                trees
                , method
                , path: staticPart
                , type: NODE_TYPE.STATIC
            })

            // isolate the parameter name
            while (i < len && path[i] !== '/') {
                i++
            }

            const parameter = path.slice(jump, i)
            params.push(parameter.slice(0, i))

            path = path.slice(0, jump) + path.slice(i)
            i = jump
            len = path.length

            // if the path is ended
            if (i === len) {
                const completedPath = path.slice(0, i)
                insertNode({
                    trees
                    , method
                    , path: completedPath
                    , type: nodeType
                    , params
                    , handler
                })
                return
            }

            // add the parameter and continue with the search
            staticPart = path.slice(0, i)
            insertNode({
                trees
                , method
                , path: staticPart
                , type: nodeType
                , params
            })

            i--
        } else if (path[i] === '*') {
            // wildcard route
            if (path[i] === '*') {
                insertNode({
                    trees
                    , method
                    , path: path.slice(0, i)
                    , type: NODE_TYPE.STATIC
                })

                // add the wildcard parameter
                params.push('*')
                insertNode({
                    trees
                    , method
                    , path: path.slice(0, len)
                    , type: NODE_TYPE.MATCH_ALL
                    , params
                    , handler
                })
                return
            }
        }
    }

    // static route
    insertNode({
        trees
        , method
        , path
        , type: NODE_TYPE.STATIC
        , params
        , handler
    })
}

const find = (trees, maxParamLength, method, pathIn) => {
    let path = pathIn
    let currentNode = trees[method]
    if (!currentNode) {
        return null
    }

    const originalPath = path
    const originalPathLength = path.length
    const params = []

    let i = 0
    let pindex = 0
    let param = null
    let wildcardNode = null
    let pathLenWildcard = 0
    let idxInOriginalPath = 0

    while (true) {
        let pathLen = path.length
        const prefix = currentNode.prefix
        const prefixLen = prefix.length
        let len = 0
        let previousPath = path

        // found the route
        if (pathLen === 0 || path === prefix) {
            const handle = currentNode.handler
            if (handle !== null && handle !== undefined) {
                const paramsObj = {}
                if (handle.paramsLength > 0) {
                    const paramNames = handle.params
                    for (i = 0; i < handle.paramsLength; i++) {
                        paramsObj[paramNames[i]] = params[i]
                    }
                }

                return {
                    params: paramsObj
                    , handler: handle.handler
                    , handlers: handle.handlers
                }
            }
        }

        // search for the longest common prefix
        i = pathLen < prefixLen ? pathLen : prefixLen
        while (len < i && path.charCodeAt(len) === prefix.charCodeAt(len)) {
            len++
        }

        if (len === prefixLen) {
            path = path.slice(len)
            pathLen = path.length
            idxInOriginalPath += len
        }

        let node = currentNode.findChild(path)

        if (node === null) {
            node = currentNode.parametricBrother
            if (node === null) {
                return getWildcardNode(wildcardNode, originalPath, pathLenWildcard)
            }

            const goBack = previousPath.charCodeAt(0) === 47 ? previousPath : '/' + previousPath
            if (originalPath.indexOf(goBack) === -1) {
                // we need to know the outstanding path so far from the originalPath since the last encountered "/" and assign it to previousPath.
                // e.g originalPath: /aa/bbb/cc, path: bb/cc
                // outstanding path: /bbb/cc
                const pathDiff = originalPath.slice(0, originalPathLength - pathLen)
                previousPath = pathDiff.slice(pathDiff.lastIndexOf('/') + 1, pathDiff.length) + path
            }

            idxInOriginalPath = idxInOriginalPath - (previousPath.length - path.length)
            path = previousPath
            pathLen = previousPath.length
            len = prefixLen
        }

        const type = node.type

        // static route
        if (type === NODE_TYPE.STATIC) {
            // if exist, save the wildcard child
            if (currentNode.wildcardChild !== null) {
                wildcardNode = currentNode.wildcardChild
                pathLenWildcard = pathLen
            }

            currentNode = node
            continue
        }

        if (len !== prefixLen) {
            return getWildcardNode(wildcardNode, originalPath, pathLenWildcard)
        }

        // if exist, save the wildcard child
        if (currentNode.wildcardChild !== null) {
            wildcardNode = currentNode.wildcardChild
            pathLenWildcard = pathLen
        }

        // parametric route
        if (type === NODE_TYPE.PARAM) {
            currentNode = node
            i = path.indexOf('/')
            if (i === -1) {
                i = pathLen
            }

            if (i > maxParamLength) {
                return null
            }

            param = originalPath.slice(idxInOriginalPath, idxInOriginalPath + i)
            if (param === null) {
                return null
            }
            params[pindex++] = param
            path = path.slice(i)
            idxInOriginalPath += i
            continue
        }

        // wildcard route
        if (type === NODE_TYPE.MATCH_ALL) {
            param = originalPath.slice(idxInOriginalPath)
            if (param === null) {
                return null
            }
            params[pindex] = param
            currentNode = node
            path = ''
            continue
        }

        wildcardNode = null
    }
}

const create = (trees) => (method, path, ...handlers) => prepareNodes(trees, method, path, handlers)

const lookup = (trees, maxParamLength) => (method, path) => {
    const cleanedPath = sanitizeUrl(path)
    return find(trees, maxParamLength, method, cleanedPath)
}

const matcher = (maxParamLength = 100) => {
    const trees = {}
    return {
        create: create(trees)
        , lookup: lookup(trees, maxParamLength)
    }
}

module.exports = matcher
