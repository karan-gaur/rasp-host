import React, { Component } from 'react';
import { Switch, Route, Redirect, BrowserRouter as Router } from 'react-router-dom';
import Home from './HomeComponent';
import Login from './LoginComponent';

class Main extends Component {

    render() {
        return (

            <Router>
                <div className="App">
                    <Switch>
                        <Route path="/home" component={Home} />
                        <Route path="/login" component={Login} />
                        <Redirect to="/login" />
                    </Switch>
                </div>
            </Router >);
    }
}

export default Main;