function dispatchEvent(event) {
  console.log(`Event '${event.name}' dispatched`);
  //find event handler and apply the payload
  eventHandlers[event.name](event.payload);
}

//https://hackage.haskell.org/package/comonad-5.0.3/docs/Control-Comonad-Trans-Store.html

//look at using the 'trans store comonad'
//the experiment function looks interesting, could the functor be 

const State = state => ({
  //based on the fantasy land comonad
  //https://github.com/fantasyland/fantasy-land#comonad
  //Note: `~>` means its a method not a function
  
  //Comonads are also functors so must implement map
  //map :: Functor f => f a ~> (a -> b) -> f b
  map: f => State(f(state)),
  
  //Required by Comonad
  //Returns the value inside the comonad
  extract: () => state,
  
  //Required by Comonad
  //extend :: Extend w => w a ~> (w a -> b) -> w b
  extend: f => State(f(State(state)))
  //this doesnt provide us a lot...
})

const LazyState = (f, state) => ({
  //https://medium.com/@drboolean/laziness-with-representable-functors-9bd506eae83f
  
  //map :: Functor f => f a ~> (a -> b) -> f b
  map: g => LazyState(x => g(f(x)), state),
  
  extract: () => f(state),
  
  //extend: g => LazyState(x => g(f(x)), state)
})



//http://www.tomharding.me/2017/04/27/pairs-as-functors/
//tom:Thank you! Writer is a really neat fit for uni-directional flow, 
//because you can actually use the value on the right-hand side as a kind
//of "exit code" to feed back to your caller
// I wrote another post on the Extend typeclass that uses pairs again but 
//as a comonad, and that lets you read from the value you've been building up,
//which is pretty neat
// it's amazing how far you can get with "a value" and "some metadata"
//http://www.tomharding.me/2017/06/19/fantas-eel-and-specification-17/
//http://www.tomharding.me/2017/06/12/fantas-eel-and-specification-16/

//Tuple can do read and write state with extend and bind/chain, but excitingly,
//function arrow (reader) can do read and write with bind and extend 
//(the other way round)
//it's almost like there's some kind of pairing between tuples and function
//arrows underneath it all...

//gb:haha interesting, I was actually looking at using a comonad(which I do 
//not understand yet) but figured out I could do a lot with just functors.
//tom:you really can. You'll need to do something monadic or comonadic 
//to do your actual data flow because it's a "side effect", but if you 
//want that to be writer-like behaviour, you can totally choose whether 
//to use pairs or functions
//just depends on which one is most comfortable for you to read

//gb: @gabejohnson Ah you mean every so often take a snapshot of state 
//then run the actions again. nice idea

//The "Adventurer" example is possibly what you want
//spoiler: `sneakyPeekMap` is `extend`



// Aaand a sneaky little monoid:

// const Sum = daggy.tagged('Sum', ['value'])

// Sum.prototype.concat = function (that) {
//   return Sum(this.value + that.value)
// }

// Sum.empty = () => Sum(0)

const Array = daggy.tagged('Array', ['value'])

Array.prototype.concat = function (that) {
  return Array([...this.value, that.value])
}

Array.empty = () => Array([])

//http://www.tomharding.me/2017/04/27/pairs-as-functors/
const Pair = T => {
  const Pair_ = daggy.tagged('Pair', ['_1', '_2'])

  //Functor
  Pair_.prototype.map = function (f) {
    return Pair_(this._1, f(this._2))
  }

  //Applicative
  Pair_.prototype.ap = function (fs) {
    return Pair_(fs._1.concat(this._1),
                 fs._2(this._2))
  }

  Pair_.of = x => Pair_(T.empty(), x)

  //Monad
  Pair_.prototype.chain = function (f) {
    const that = f(this._2)

    return Pair_(this._1.concat(that._1),
                 that._2)
  }
  
  //Comonad
  Pair_.prototype.extend = function(f) {
    return Pair_(this._1, f(this))
  }
  
  return Pair_
}


//http://www.tomharding.me/2017/04/27/pairs-as-functors/
// State of the world. 
// The Left contains changes to the world, like Sum(100). 
//   Its a Monoid, so starts with an empty and folds on itself
// The Right represents the current state

//left will be the actions that have occured
//right will be the state of the application, the right value
//   is like an exit code which is whats passed into the view

//extend will accept the render??  ..lets you read from the value

const StorePair = Pair(Array)

const Complete = 'Complete';
const InProgress = 'InProgress';

let initialState = {
  todos: [{
    text: 'An Initial ToDo',
    status: InProgress
  }],
  filters: []
}

let actionHandlers = {
  ADD_TODO: (payload, state) => {
    let {todos} = state;
    console.log('add', payload)
    return {...state,
            todos: [...todos, 
                    {text: payload, status: InProgress }]};
  },
  INPROGRESS_TODO: (payload, state) => {
    let {index, item} = payload
    let {todos} = state;
    todos[index].status = InProgress;
    return {...state, 
            todos: todos};
  },
  COMPLETE_TODO: (payload, state) => {
    let {index} = payload
    let {todos} = state;
    todos[index].status = Complete;
    return {...state, 
            todos: todos};
  },
  REMOVE_TODO: (payload, state) => {
    let {index} = payload;
    let {todos} = state;
    return {...state,
            todos: R.remove(index, 1, todos)};    
  }
}

//the io?, passed into Extend
//Gets the value out
// renderView :: StorePair State -> State
const renderView =
  ({ _1: actions , _2: state }) =>
    (console.log('actions',actions), console.log('state',state), state)

//processAction :: State -> Store State
const processAction =
  handlers => action => state => 
    StorePair(Array(action), handlers[action.name](action.payload, state))

//these are 'processAction' types... 
//they would be dynamically created at runtime.

const CreateFirstTodo = 
  state =>
    processAction(actionHandlers)
                 ({name: 'ADD_TODO', payload: 'First'})
                 (state)

const CreateSecondTodo = 
  state =>
    processAction(actionHandlers)
                 ({name: 'ADD_TODO', payload: 'Second'})
                 (state)
  
const CompleteFirstTodo =
  state =>
    processAction(actionHandlers)
                 ({name: 'COMPLETE_TODO', payload: {index: 1}})
                 (state)


CreateFirstTodo(initialState)
  .extend(renderView)
  .chain(CreateSecondTodo)
  .extend(renderView)
  .chain(CompleteFirstTodo)
  .extend(renderView)

//slayDragon  :: User -> Adventurer User
//eat         :: User -> Adventurer User
//areWeHungry :: Adventurer User -> User

//processAction :: State -> Store State
//renderView    :: Store State -> State

// slayDragon(initialUser)
// .sneakyPeekMap(areWeHungry).chain(eat)
// // Pair(Sum(100), not hungry)  
// .chain(slayDragon)
// .sneakyPeekMap(areWeHungry).chain(eat)
// // Pair(Sum(200), not hungry)




const Identity = x => x;
//State.of Identity

//'Store' will take an initial state and the action handlers.
//Actions will be dispatched to the Store and 
class Store {
  constructor(initialState, actionHandlers) {
    this._history = [{ 
      //state: new State(initialState),
      //state: State(initialState),
      state: LazyState(Identity, initialState),
      action: null
    }];
    this._handlers = actionHandlers;
    this._subscribers = [];
  }
  
  current() {
    return this._history[0].state;
  }
  
  dispatchAction(action) {
    console.log(`Action '${action.name}' dispatched`);
    if (this._handlers[action.name] === undefined) 
      throw new Error(`Action handler not found: '${action.name}'`);
    
    //Either need to `map` over innerState...
    let handler = innerState => this._handlers[action.name](action.payload, innerState);
    let newState = this.current().map(handler);

    //or extend over state
    //does this mean that the function needs to know what type w is?
    //let handler = state => this._handlers[action.name](action.payload, state.extract());
    //let newState = this.current().extend(handler);
    
    
    //What if the actionHandlers were isomorphic? then we could go backwards
    
    this._updateState(action, newState);
  }
  
  _updateState(action, state) {
    this._history.unshift({
      state: state,
      action: action
    });
    //update subscribers
    this._subscribers.forEach(s => {
      try {
        console.log('Subscriber callback executed.');
        s(this.current().extract());
      } catch (e) {
        console.error('Error on subscribe', e)
      }
    })
  }
  
  //Some type of 'publish' mechanism is needed to 
  //alert subscribers of state changes.
  //Need to add try/catch and logging around any subscriber calls
  subscribe(callback) {
    this._subscribers.push(callback)
  }
  
  //Thought: deprioritize view updates by delaying the subscribe to the next tick
  
}


//# Application Code
// The application code below uses the framework code defined above.

// const Complete = 'Complete';
// const InProgress = 'InProgress';

//The initial application state
// let initialState = {
//   todos: [{
//     text: 'An Initial ToDo',
//     status: InProgress
//   }],
//   filters: []
// }

// let actionHandlers = {
//   ADD_TODO: (payload, state) => {
//     let {todos} = state;
//     return {...state,
//             todos: [...todos, {text: payload, status: InProgress }]};
//   },
//   INPROGRESS_TODO: (payload, state) => {
//     let {index, item} = payload
//     let {todos} = state;
//     todos[index].status = InProgress;
//     return {...state, 
//             todos: todos};
//   },
//   COMPLETE_TODO: (payload, state) => {
//     let {index} = payload
//     let {todos} = state;
//     todos[index].status = Complete;
//     return {...state, 
//             todos: todos};
//   },
//   REMOVE_TODO: (payload, state) => {
//     let {index} = payload;
//     let {todos} = state;
//     return {...state,
//             todos: R.remove(index, 1, todos)};    
//   }
// }

let store = new Store(initialState, actionHandlers);


//Set up the UI
function render(state) {
  //Click Handlers
  let onAdd = (e) => {
    if (e.key === 'Enter') {
      store.dispatchAction({name: 'ADD_TODO', payload: e.target.value});
    }
  }
  let onToggle = (index, item) => 
    item.status === InProgress ?
      store.dispatchAction({name: 'COMPLETE_TODO', payload: {index, item}}) :
      store.dispatchAction({name: 'INPROGRESS_TODO', payload: {index, item}});
  let onDelete = (index, item) => 
    store.dispatchAction({name: 'REMOVE_TODO', payload: {index, item}});
   
  //Components
  let ListItem = React.createClass({
  	render() {
      let textStyle = {
        textDecoration: this.props.item.status === Complete ? 'line-through' : ''
      }
      return (
        <li>
          <span onClick={this.onToggle}
            style={textStyle}>
            {this.props.item.text}</span>
          <span onClick={this.onClickDelete}>    X</span>
        </li>
      );
    },
    onToggle() {
      this.props.onToggle(this.props.index, this.props.item);
	},
    onClickDelete() {
      this.props.onDelete(this.props.index, this.props.item);
    }
  });
  const listItems = state.todos.map((item, index) =>
    <ListItem index={index} key={index} item={item}
      onToggle={onToggle}
      onDelete={onDelete} />
  );
  let el = (
    <div>
      <h1>ToDos</h1>
      <span>Enter some text, press enter:</span>
      <input type="text" onKeyPress={onAdd} />
      <ul> 
        {listItems || <li>None Found</li>}
      </ul>
      <div>(Click on the item to complete it, click the X to delete it)</div>
    </div>
  );
  ReactDOM.render(
    el,
    document.getElementById('root')
  );
}
//register to listen to changes
store.subscribe(render);
//load the ui
render(initialState);



/*   NOTES    */

