function interpExpression(state, e) {
    if (e.kind === 'number' || e.kind === 'boolean') {
        return e.value;
    } else if (e.kind === 'variable') {
        let scopeContainsVarName = getScopeClosestToInnerMostScopeWithVarX(state, e.name);
        if (scopeContainsVarName !== null) {
            return lib220.getProperty(scopeContainsVarName, e.name).value;
        } else {
            console.log("variable: " + e.name + " is not defined");
            assert(false);
        }
    } else if (e.kind === 'operator') {
        let v1 = interpExpression(state, e.e1);
        let v2 = interpExpression(state, e.e2);
        //edge cases: must be of same type, +-*/>< must be between int, &| must be between bool
        if (typeof (v1) !== typeof (v2)) {
            console.log("two exps must be the same kind for operator: " + e.op);
            assert(false);
        }
        if (e.op === '+'
            || e.op === '-'
            || e.op === '*'
            || e.op === '/'
            || e.op === '>'
            || e.op === '<'
        ) {
            if (typeof (v1) !== 'number') {
                console.log("arithmemtic operator only supports the number type.");
                assert(false)
            }
        }
        if (e.op === '&&'
            || e.op === '||'
        ) {
            if (typeof (v1) !== 'boolean') {
                console.log("logic operator only supports the boolean type.");
                assert(false)
            }
        }
        //for valid combinations of vars and operators, perform respective operation  
        if (e.op === '+') {
            return v1 + v2;
        } else if (e.op === '-') {
            return v1 - v2;
        } else if (e.op === '*') {
            return v1 * v2;
        } else if (e.op === '/') {
            if (v2 === 0) {
                return (v1 / v2); 
                //let JS to pass Infinity back 
            }
            return parseInt(v1 / v2);
        } else if (e.op === '&&') {
            return v1 && v2;
        } else if (e.op === '||') {
            return v1 || v2;
        } else if (e.op === '>') {
            return v1 > v2;
        } else if (e.op === '<') {
            return v1 < v2;
        } else if (e.op === '===') {
            return v1 === v2;
        } else {
            console.log("Unsupported op: " + e.op);
            assert(false);
        }
    } else {
        console.log("Unsupported expression kind: " + e.kind);
        assert(false);
    }
}

//use to get the local scope to store a newly declared var. 
function getCurrentScopeState(state) {
    return state;
}

//return null if there's no such var named x in any scope
//start searching from inner most scope
function getScopeClosestToInnerMostScopeWithVarX(state, x) {
    let currentState = state;
    while (currentState !== null) {
        if (lib220.getProperty(currentState, x).found) {
            return currentState;
        }
        if(lib220.getProperty(currentState, '$innerScopeLL').found){
          currentState = lib220.getProperty(currentState, '$innerScopeLL').value;
        }
        else{
          currentState = null
        }
    }
    return null;
}


//used when we have a new block to be parsed. the net effect 
// is to insert a new  state into the head of the LL. 
function pushNewEmptyStateScope(state) {
    //three lines for clarity 
    console.log("pushNewEmptyStateScope state:");
    console.log(state);
    console.log(state);
    return  { $innerScopeLL: state };
    //one liner, they are the same
    //lib220.setProperty(state, '$innerScopeLL', {$innerScopeLL: lib220.getProperty(state, '$innerScopeLL').value});
}
function popStateScope(state) {
    console.log("popStateScope state:");
    console.log(state);
    let currentLocalStateScope = lib220.getProperty(state, '$innerScopeLL').value;
    if (currentLocalStateScope === null) {
        //should not be there, but this means that popping out a state scope when 
        //we are already in the top most scope, means there's a but in the code, 
        //or we did not receive a well formated programe states from parser
        //assert it. 
        system.console("popping out state when we are on the global state");
        assert(false);
    }
    let newEmptyStateScope = lib220.getProperty(currentLocalStateScope, '$innerScopeLL').value;
    lib220.setProperty(state, '$innerScopeLL', newEmptyStateScope);
    console.log(state);
}

//state:State, s:Stmt
function interpStatement(state, s) {
    switch (s.kind) { // statements.forEach(s => ...
        case 'assignment': {
            let name = s.name;
            let expVal = interpExpression(state, s.expression);
            let scopeContainsVarName = getScopeClosestToInnerMostScopeWithVarX(state, name);
            if (scopeContainsVarName === null) {
                //not declared, error out
                console.log("undefined of var: " + name);
                assert(false);
            } else {
                lib220.setProperty(scopeContainsVarName, name, expVal);
            }
            break;
        }
        case 'let': {
            let name = s.name;
            let expVal = interpExpression(state, s.expression);
            let currentScopeState = getCurrentScopeState(state);
            if (lib220.getProperty(currentScopeState, name).found) {
                //already declared, error out
                console.log("redefination of var: " + name);
                assert(false);
            } else {
                lib220.setProperty(currentScopeState, name, expVal);
            }
            break;
        }
        case 'print': {
            console.log(interpExpression(state, s.expression));
            break;
        }
        case 'if': {
            let testVal = interpExpression(state, s.test);
            if (typeof (testVal) !== 'boolean') {
                //exp in if statement is not a boolean exp, error out
                console.log("exp for if condiction must be a boolean exp");
                assert(false);
            }
            else {
                //create a new empty state block to hold local scope this is always the head of LL. 
                if (testVal) {
                    interpBlock(pushNewEmptyStateScope(state), s.truePart);
                } else {
                    interpBlock(pushNewEmptyStateScope(state), s.falsePart);
                }
                //we are out of the scope, so we need to pop the head and get rid of it 
            }
            break;
        }
        case 'while': {
            let testVal = interpExpression(state, s.test);
            if (typeof (testVal) !== 'boolean') {
                //exp in if statement is not a boolean exp, error out
                console.log("exp for while condiction must be a boolean exp");
                assert(false);
            }
            else {
                let newState = pushNewEmptyStateScope(state);
                let firstIteratioInwhile = true;
                while (testVal) {
                    if (firstIteratioInwhile) {
                        interpBlock(newState, s.body);
                        convertLetToassignment(s.body);
                        firstIteratioInwhile = false;
                    } else {
                        interpBlock(newState, s.body);
                    }
                    // did not check the testVal's type since there's no way 
                    // testvalue type can be changed in current language design
                    // only get the new value 
                    testVal = interpExpression(state, s.test);
                }
                //popStateScope(state);
            }
            break;
        }
        default: {
            console.log("Unknown kind of statement: ", s.kind);
            assert(false);
        }
    }
}

//state:State, s: Stmt[]
function interpBlock(state, b) {
    for (let i = 0; i < b.length; ++i) {
        interpStatement(state, b[i]);
    }
}

//state:State, s: Stmt[]
function convertLetToassignment(b) {
    for (let i = 0; i < b.length; ++i) {
        if (b[i].kind === 'let') {
            b[i].kind = 'assignment';
        }
    }
}

//$innerScopeLL is a linked list holds the inner block variables.
//it's a stack, the head of the LL is the inner most scope. 
//if it is empty, it means that we are not in any inner block. 
function interpProgram(p) {
    //init state so that we don't have any var in global state, and the head of LL tracked
    //by $innerScopeLL has zero element, it's a empty linked list, meaning that 
    //we are still in global scope, we are not in local scope specified by if or while. 
    let state = {  };
    interpBlock(state, p);
    return state;
}

//tests//

test('Additional with var', function () {
    let r = interpProgram(parser.parseProgram("let x = 10; let y = 2; let z=7+x+y+7;").value);
    assert(r.z === 26 && r.x === 10 && r.y === 2);
}
)

test('Subtraction with Var', function () {
    let r = interpProgram(parser.parseProgram("let x = 10; let y = 2; let z=50-x-y; let w = x-y;").value);
    assert(r.z === 38 && r.x === 10 && r.y === 2 && r.w === 8);
}
)

test('Multiplication with var', function () {
    let r = interpProgram(parser.parseProgram("let x = 1; let y = 2; let z=x*y*5;").value);
    assert(r.z === 10 && r.x === 1 && r.y === 2);
}
)

test('Division with var', function () {
    let r = interpProgram(parser.parseProgram("let x = 10; let y = 2; let z=x/y;").value);
    assert(r.z === 5 && r.x === 10 && r.y === 2);
}
)

test('Division by zero', function () {
    let r = interpProgram(parser.parseProgram("let x = 10; let y = 0; let z=x/y;").value);
    assert(r.z === Infinity && r.x === 10 && r.y === 0);
}
)

test('Bool comparison', function () {
    let r = interpProgram(parser.parseProgram("let x = true; let y = false; let z= true; let w = x && y || false && z; "
        + "let a = w ||z;"
    ).value);
    assert(r.x === true && r.y === false && r.w === false && r.a === true);
}
)

test('Valid short circuit', function () {
    let r = interpProgram(parser.parseProgram("let x = 10+2-7*11;").value);
    assert(r.x === -65);
}
)

test('Precedence passes', function () {
    let r = interpProgram(parser.parseProgram("let x = 3;let y = 5; let z = 7; let w = x + y * z; x = x*y +z; ").value);
    assert(r.w === 38 && r.x === 22);
}
)

test('Negative variables', function () {
    let r = interpProgram(parser.parseProgram("let x = -3;let y = 5; let z = 7; let w = x + y * z; x =2 * -7;  y = 2 - -7;").value);
    assert(r.w === 32 && r.x === -14 && r.y === 9);
}
)

test('Greater than', function () {
    let r = interpProgram(parser.parseProgram("let x =3>2;let y = 2>3; let z = 5; let w = z > 10;").value);
    assert(r.x === true && r.y === false && r.w === false);
}
)

test('Less than', function () {
    let r = interpProgram(parser.parseProgram("let x =3<2;"
        + "let y = 2<3; "
        + " let z = 5;"
        + " let w = z < 10;"
    ).value);
    assert(r.x === false && r.y === true && r.w === true);
}
)

test('Print', function () {
    let r = interpProgram(parser.parseProgram(
        "let x =3<2;"
        + "let y = 2<3; "
        + " let z = 5;"
        + " let w = z < 10;"
        + "print(x);"
        + "print(y);"
        + "print(z);"
        + "print(w);"
    ).value);
    assert(r.x === false && r.y === true && r.z === 5 && r.w === true);
}
)

test('Test scoping in if and while loop',
    function () {
        let r = interpProgram(parser.parseProgram(
            "let y = 12; "
            + "let count =0;"
            + "let result =0;"
            + "while(y > 0) {"
            + "let x = 11; "
            + "while(x > 0) {"
            + "count = count + 1;"
            + "x = x - 1;"
            + "}"
            + "y = y - 1;"
            + "}"
        ).value);
        assert(r.count === 132);
    }
)