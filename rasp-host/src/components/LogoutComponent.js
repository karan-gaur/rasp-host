import React from 'react';
import { Component } from 'react';

class Logout extends Component {
    constructor(props) {
        super(props);
        this.state = {
            email: email
        }
    }


    render() {
        return (
            this.setState({ ...email, email: '' })
                .props.history.push("/login")

        );
    }
}