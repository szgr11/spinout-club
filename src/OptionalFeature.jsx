import React from 'react';
export default class OptionalFeature extends React.Component {
 state={failed:false};
 static getDerivedStateFromError(){return {failed:true};}
 render(){return this.state.failed?<p role="status" className="member-tool-note">This member tool is temporarily unavailable. Please try again later.</p>:this.props.children;}
}
