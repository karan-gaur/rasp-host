import React, { Component } from 'react';
import { Button, Row, Label } from 'reactstrap';
import '../App.css';
import { LocalForm, Errors, Control } from 'react-redux-form';


//For validation
const required = (val) => val && val.length;
const validEmail = (val) => /^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,4}$/i.test(val);
const minLength = (len) => (val) => val && (val.length >= len);

class Login extends Component {

    constructor(props) {
        super(props);
        this.state = {
            email: "",
            touched: {
                email: false
            }
        }
        this.onSubmit = this.onSubmit.bind(this);
        this.handleBlur = this.handleBlur.bind(this);
        this.onChangeInput = this.onChangeInput.bind(this);
    }

    onChangeInput = e => {
        e.preventDefault();
        this.setState({ email: e.target.value })
    }

    onSubmit(values) {
        // Save to local storage
        localStorage.setItem("email", values.email)
        this.props.history.push('/home');
    }

    handleBlur = (field) => (evt) => {
        this.setState({
            touched: { ...this.state.touched, [field]: true }
        });
    }

    render() {
        return (
            <div className="outer bodylogin">
                <div className="inner">
                    <div className="App">
                        <div className="App-header">
                            <header className="App-header">
                                <h3 className="h1"><span className="fa fa-sign-up fa-lg" style={{ textDecorationColor: 'red' }}></span>  Sign In</h3> <br /> <br />
                                <LocalForm onSubmit={(values) => this.onSubmit(values)}>
                                    <Row className="form-group">
                                        <Label htmlFor="email">Email address</Label>
                                        <Control.text model=".email" autoComplete="off" className="form-control"
                                            onChange={this.onChangeInput}
                                            validators={{
                                                required, validEmail
                                            }} />
                                        <Errors
                                            className="text-danger" model=".email" show="touched"
                                            messages={{
                                                required: '',
                                                validEmail: 'Invalid email'
                                            }}
                                        />
                                    </Row>
                                    <Row className="form-group">
                                        <Label htmlFor="password">Password</Label>
                                        <Control.text model=".password" autoComplete="off" className="form-control"
                                            validators={{ required, minLength: minLength(3) }}
                                        />
                                        <Errors
                                            className="text-danger" model=".password" show="touched"
                                            messages={{
                                                required: '',
                                                minLength: 'Password must be greater than 3 characters'
                                            }} />
                                    </Row>
                                    <br />
                                    <Button type="submit" color="primary">Submit</Button>
                                </LocalForm>
                            </header>
                        </div>
                    </div>
                </div>
            </div>
        );
    }

}

export default Login;