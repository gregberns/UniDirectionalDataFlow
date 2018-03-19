//# Introduction
//The following is a generalized architecture based on the Elm architecture
// and the many subsequent derivations of it.
//The essential idea of the Elm architecture is that a User Interface has a
//  'uni-directional' data flow, which means data flows in a single directions.
//Here's a simple example:
// Button Click Event -> Handle Event -> Make Http Call -> Update State -> Update View

//Events occur which causes the system('services') to react to them. The system
// then sends commands to the state of the system to transition from 'State A' to 'State B'.
// The Views then re-render based on the change to the new State.

//# Adoption
//This architecture has been adopted by numerous frameworks:
// ClosureScript's Reframe - https://github.com/Day8/re-frame
// React's Redux - https://github.com/reactjs/redux
// PureScript's Halogen - https://github.com/slamdata/purescript-halogen


// This solution is broken into several components
// * Events - An event handling system is not seen in React, but 'Signals' are in Halogen 


//The first half of this solution has to do 

//# Event Dispatch and Handling
// Events are generally user initiated actions such as 
//  button clicks or the submision of a form
// The objective is to declaritively notify the system that something occured

//## Initiailization
// The event system needs to be initialized with one or more event handlers
// An event handler, when called, will accept a payload and process the event
// Things like Http calls, business rule calculations and such 
//  should occur in the handler
let eventHandlers = {};
function registerEvent(name, handler) {
  eventHandlers[name] = handler;
}

//## Firing Events
// Once a view is initialized, events can be 'dispatched' or fired from it
// When an event is dispatched it's handler will be called and the effects
//  of the handler may effect the rest of the system. It may initiate 
function dispatchEvent(event) {
  console.log(`Event '${event.name}' dispatched`);
  //find event handler and apply the payload
  eventHandlers[event.name](event.payload);
}


/* START -- NEW CODE */

// 'State' retains the applications state. The unique 
//thing about application state is that everytime it 
//is changed a new one is generated. The benefit is that
//each state can be saved and when debugging a problem it
//makes it easier to find issues. This could be turned 
//off in prod.
class State {
  constructor(initialState) {
    this._state = initialState
  }
  //Required by Comonad
  //Returns the value inside the comonad
  extract() {
    return this._state;
  }
  //Required by Comonad
  //must follow the rules of Functor
  //extend :: Extend w => w a ~> (w a -> b) -> w b
  extend(f) {
    return new State(f(this.extract()));
  }
}

//'Store' will take an initial state and the action handlers.
//Actions will be dispatched to the Store and 
class Store {
  constructor(initialState, actionHandlers) {
    this._history = [{ 
      state: new State(initialState),
      action: null
    }];
    this._handlers = actionHandlers;
    this._subscribers = [];
  }
  
  current() {
    return this._history[0].state;
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
  
  dispatchAction(action) {
    console.log(`Action '${action.name}' dispatched`);
    if (this._handlers[action.name] === undefined) 
      throw new Error(`Action handler not found: '${action.name}'`);
    let handler = innerState => this._handlers[action.name](action.payload, innerState);
    let newState = this.current().extend(handler);
    this._updateState(action, newState);
  }
  //Some type of 'publish' mechanism is needed to 
  //alert subscribers of state changes.
  //Need to add try/catch and logging around any subscriber calls
  subscribe(callback) {
    this._subscribers.push(callback)
  }
  
  //Thought: deprioritize view updates by delaying the subscribe to the next tick
  
}

// Add a 'diff' of the state function, to see differentces
//between states: 'what does the state transition look like??' 
// instead of having to look at the whole object

/* END -- NEW CODE */

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



/*   NOTES    */

//Query:
//App State is an Observable. This provides a way to:
//* Push changes on App State change
//* Create 'views' based off the base state

//View:
//One or more components that accept state or a 'view' off the main state

//Refrences:
//  https://github.com/Day8/re-frame


//Maybe its not the Store thats Foldable, instead its a stream of Actions

//https://eventstore.org/blog/20130212/projections-1-theory/
// When we talk about a projection off of an event stream basically what we 
// are describing is running a series of functions over the stream. We could 
// as our simplest possible projection have a projection that runs through all
// of the events in the system (in order) passing current state from one 
// function to the next. The simplest of these could be to count how many events there are.

//https://eventstore.org/blog/20130213/projections-2-a-simple-sep-projection/
//when() fn to register handlers/
//each function registered in 'when()' should supply state and the event payload
//emit() to emit events/changes?

// declaritively update state??

//Getter Getter
//() => () => Try<Option<T>>
//Enumerable / Enumerator - The Consumer is in charge!
// getEnumerator():Enumerator<T>  / moveNext():bool, current():T

//Setter Setter
//Try<Option<T>> => () => ()
//Observable / Observer - The producer is in charge
// Subscribe(Observer<T>)  / onCompleted(), onError(Throwable), onNext(T)


