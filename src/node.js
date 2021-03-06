const NODE_TYPE = {
    STATIC: 0
    , PARAM: 1
    , MATCH_ALL: 2
}

class Node {
    constructor({
        prefix = '/'
        , type = NODE_TYPE.STATIC
        , handler
        , children = {}
    } = {}) {
        this.prefix = prefix
        this.label = prefix[0]
        this.type = type
        this.handler = handler
        this.children = children
        this.wildcardChild = null
        this.numberOfChildren = Object.keys(children).length
        this.parametricBrother = null
    }

    getLabel() {
        return this.prefix[0]
    }

    addChild(node) {
        let label = ''
        switch (node.type) {
            case NODE_TYPE.STATIC:
                label = node.getLabel()
                break
            case NODE_TYPE.PARAM:
                label = ':'
                break
            case NODE_TYPE.MATCH_ALL:
                this.wildcardChild = node
                label = '*'
                break
            default:
                throw new Error(`Unknown node type: ${node.type}`)
        }

        this.children[label] = node
        this.numberOfChildren = Object.keys(this.children).length

        const labels = Object.keys(this.children)
        let parametricBrother = this.parametricBrother
        for (let i = 0; i < labels.length; i++) {
            const child = this.children[labels[i]]
            if (child.label === ':') {
                parametricBrother = child
                break
            }
        }

        const iterate = (nod) => {
            if (!nod) {
                return
            }

            if (nod.type !== NODE_TYPE.STATIC) {
                return
            }

            if (nod !== this) {
                nod.parametricBrother = parametricBrother || nod.parametricBrother
            }

            const lab = Object.keys(nod.children)
            for (let i = 0; i < lab.length; i++) {
                iterate(nod.children[lab[i]])
            }
        }

        iterate(this)

        return this
    }

    reset(prefix) {
        this.prefix = prefix
        this.children = {}
        this.type = NODE_TYPE.STATIC
        this.handler = null
        this.numberOfChildren = 0
        this.wildcardChild = null
        return this
    }

    findByLabel(path) {
        return this.children[path[0]]
    }

    findChild(path) {
        let child = this.children[path[0]]
        if (child !== undefined && (child.numberOfChildren > 0 || child.handler !== null)) {
            if (path.slice(0, child.prefix.length) === child.prefix) {
                return child
            }
        }

        child = this.children[':']
        if (child !== undefined && (child.numberOfChildren > 0 || child.handler !== null)) {
            return child
        }

        child = this.children['*']
        if (child !== undefined && (child.numberOfChildren > 0 || child.handler !== null)) {
            return child
        }

        return null
    }

    setHandler(handlerIn, params) {
        if (!handlerIn) return
        const paramsLength = params.length
        let handlers = null
        let handler = handlerIn[0]
        if (handlerIn.length > 1) {
            handlers = handlerIn
            handler = null
        }

        this.handler = {
            handler
            , handlers
            , params
            , paramsLength
        }
    }
}

module.exports = {
    Node
    , NODE_TYPE
}

