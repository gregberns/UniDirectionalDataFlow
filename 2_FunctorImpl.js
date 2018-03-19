function dispatchEvent(event) {
  console.log(`Event '${event.name}' dispatched`);
  //find event handler and apply the payload
  eventHandlers[event.name](event.payload);
}

// class State {
//   constructor(initialState) {
//     this._state = initialState
//   }
//   //Required by Comonad
//   //Returns the value inside the comonad
//   extract() {
//     return this._state;
//   }
//   //Required by Comonad
//   //must follow the rules of Functor
//   //extend :: Extend w => w a ~> (w a -> b) -> w b
//   extend(f) {
//     return new State(f(this.extract()));
//   }
// }

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

const Complete = 'Complete';
const InProgress = 'InProgress';

//The initial application state
let initialState = {
  todos: [{
    text: 'An Initial ToDo',
    status: InProgress
  }],
  filters: []
}

let actionHandlers = {
  ADD_TODO: (payload, state) => {
    let {todos, filters} = state;
    todos = todos.concat({ text: payload, status: InProgress })
    return {todos, filters};
  },
  INPROGRESS_TODO: (payload, state) => {
    let {index, item} = payload
    let {todos, filters} = state;
    todos[index].status = InProgress;
    return {todos, filters};    
  },
  COMPLETE_TODO: (payload, state) => {
    let {index, item} = payload
    let {todos, filters} = state;
    todos[index].status = Complete;
    return {todos, filters};    
  },
  REMOVE_TODO: (payload, state) => {
    let { index, item } = payload;
    let {todos, filters} = state;
    todos = R.remove(index, 1, todos)
    return {todos, filters};    
  }
}

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

/*
HTML for react:
<div id="root"></div>
<script src="https://fb.me/react-15.1.0.js"></script>
<script src="https://fb.me/react-dom-15.1.0.js"></script>
*/