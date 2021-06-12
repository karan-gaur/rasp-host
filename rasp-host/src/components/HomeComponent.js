import React, { Component } from 'react';
import { LocalForm, Control, Errors } from 'react-redux-form';
import { NavLink } from 'react-router-dom';
import { NavItem, Navbar, NavbarBrand, Nav, NavbarToggler, Button, Collapse, Jumbotron, Input, Row } from 'reactstrap';

class Home extends Component {
    constructor(props) {
        super(props);
        let email = localStorage.getItem("email")
        if (!email) {
            this.props.history.push("/login")
        }
        this.state = {
            email: email
        }
    }

    render() {

        return (
            <>
                <div>
                    <Navbar dark expand="md">
                        <div className="container">
                            <NavbarBrand className="ml-auto" href="/">
                                <img src="assets\images\Logo X copy.png" height="30" width="41" alt="Project X" />
                            </NavbarBrand>
                            <Collapse navbar>
                                <Nav navbar>
                                    <NavItem >
                                        <NavLink className="nav-link" to="/logout">
                                            <span className="fa fa-upload fa-sm "></span>
                                        </NavLink>
                                    </NavItem>

                                    <NavItem style={{}}>
                                        <NavLink className="nav-link" to="/logout">
                                            <span className="fa fa-folder fa-lg "></span>
                                        </NavLink>
                                    </NavItem>


                                    {/* <NavItem style={{}}>
                                    <NavLink className="nav-link" to="/logout">
                                        <span className="fa fa-sign-out fa-lg fa-2x"></span>
                                    </NavLink>
                                </NavItem> */}
                                </Nav>
                            </Collapse>
                        </div>
                    </Navbar>
                    <div className="container">
                        <LocalForm>
                            <Row className="form-group" id="fileUpload" hidden>
                                <Control.file model=".fileupload"></Control.file>
                                <Button type="submit" color="primary">Submit</Button>
                            </Row>

                            <Row>

                            </Row>

                        </LocalForm>
                    </div>
                </div>
            </>
        );
    }
}

export default Home;