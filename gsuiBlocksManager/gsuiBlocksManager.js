"use strict";

class gsuiBlocksManager {
	constructor( root ) {
		this.rootElement = root;
		this.__offset = 0;
		this.__fontSize = 16;
		this.__blcs = new Map();
		this.__blcsEditing = new Map();
		this.__blcsSelected = new Map();
		this.__uiPanels = new gsuiPanels( root );
		this.__uiTimeline = new gsuiTimeline();
		this.__elPanGridWidth = 0;
		this.__magnet = root.querySelector( ".gsuiBlocksManager-magnet" );
		this.__elLoopA = root.querySelector( ".gsuiBlocksManager-loopA" );
		this.__elLoopB = root.querySelector( ".gsuiBlocksManager-loopB" );
		this.__selection = root.querySelector( ".gsuiBlocksManager-selection" );
		this.__elPanGrid = root.querySelector( ".gsuiBlocksManager-gridPanel" );
		this.__magnetValue = root.querySelector( ".gsuiBlocksManager-magnetValue" );
		this.__sideContent = root.querySelector( ".gsuiBlocksManager-sidePanelContent" );
		this.__elCurrentTime = root.querySelector( ".gsuiBlocksManager-currentTime" );
		this.__rowsContainer = root.querySelector( ".gsuiBlocksManager-rows" );
		this.__rowsWrapinContainer = root.querySelector( ".gsuiBlocksManager-rowsWrapin" );
		this.__rows = this.__rowsContainer.getElementsByClassName( "gsui-row" );
		this.__uiBeatlines = new gsuiBeatlines( root.querySelector( ".gsuiBeatlines" ) );

		this.onaddBlock =
		this.oneditBlock =
		this.onremoveBlock =
		this.onchange =
		this.onchangeLoop =
		this.onchangeCurrentTime = () => {};
		this.__elPanGrid.onresizing = this.__gridPanelResizing.bind( this );
		this.__uiTimeline.oninputLoop = this.__loop.bind( this );
		this.__uiTimeline.onchangeLoop = ( isLoop, a, b ) => this.onchangeLoop( isLoop, a, b );
		this.__uiTimeline.onchangeCurrentTime = t => {
			this.__currentTime( t );
			this.onchangeCurrentTime( t );
		};
		root.querySelector( ".gsuiBlocksManager-timelineWrap" ).append( this.__uiTimeline.rootElement );

		this.__rowsContainer.oncontextmenu =
		root.ondragstart = () => false;
		root.onkeydown = this._keydown.bind( this );
		this.__rowsScrollTop =
		this.__rowsScrollLeft = -1;
		this.__magnet.onclick = this.__onclickMagnet.bind( this );
		this.__sideContent.onwheel = this.__onwheelPanelContent.bind( this );
		this.__sideContent.onscroll = this.__onscrollPanelContent.bind( this );
		this.__rowsContainer.onwheel = this.__onwheelRows.bind( this );
		this.__rowsContainer.onscroll = this.__onscrollRows.bind( this );
		root.onwheel = e => { e.ctrlKey && e.preventDefault(); };

		this.__eventReset();
		this.timeSignature( 4, 4 );
		this.__magnetValue.textContent = this.__uiTimeline.stepRound;
	}

	// Public methods
	// ............................................................................................
	timeSignature( a, b ) {
		this.__uiTimeline.timeSignature( a, b );
		this.__uiBeatlines.timeSignature( a, b );
	}
	currentTime( beat ) {
		this.__uiTimeline.currentTime( beat );
		this.__currentTime( beat );
	}
	loop( a, b ) {
		this.__uiTimeline.loop( a, b );
		this.__loop( Number.isFinite( a ), a, b );
	}
	setPxPerBeat( px ) {
		const ppb = Math.round( Math.min( Math.max( 8, px ) ), 512 );

		if ( ppb !== this.__pxPerBeat ) {
			const ppbpx = ppb + "px";

			this.__pxPerBeat = ppb;
			this.__uiTimeline.offset( this.__offset, ppb );
			this.__uiBeatlines.pxPerBeat( ppb );
			clearTimeout( this.__beatlinesRendering );
			this.__beatlinesRendering = setTimeout( () => this.__uiBeatlines.render(), 100 );
			this.__elLoopA.style.fontSize =
			this.__elLoopB.style.fontSize =
			this.__elCurrentTime.style.fontSize = ppbpx;
			Array.from( this.__rows ).forEach( el => el.firstElementChild.style.fontSize = ppbpx );
			this._setPxPerBeat && this._setPxPerBeat( ppb );
			return true;
		}
		return false;
	}
	setFontSize( px ) {
		const fs = Math.min( Math.max( 8, px ), 64 );

		if ( fs !== this.__fontSize ) {
			const isSmall = fs <= 44;

			this.__fontSize = fs;
			this.__sideContent.style.fontSize =
			this.__rowsContainer.style.fontSize = fs + "px";
			Array.from( this.__rows ).forEach( el => el.classList.toggle( "gsui-row-small", isSmall ) );
			return true;
		}
		return false;
	}
	getDuration() {
		const bPM = this.__uiTimeline._beatsPerMeasure,
			dur = Object.values( this._getData() )
				.reduce( ( dur, blc ) => (
					Math.max( dur, blc.when + blc.duration )
				), 0 );

		return Math.max( 1, Math.ceil( dur / bPM ) ) * bPM;
	}
	getBlocks() {
		return this.__blcs;
	}

	// Blocks methods
	// ............................................................................................
	block_when( el, v ) { el.style.left = v + "em"; }
	block_duration( el, v ) { el.style.width = v + "em"; }
	block_selected( el, v ) { el.classList.toggle( "gsuiBlocksManager-block-selected", !!v ); }
	block_deleted( el, v ) { el.classList.toggle( "gsuiBlocksManager-block-hidden", !!v ); }

	// Private small getters
	// ............................................................................................
	__getRow0BCR() { return this.__rows[ 0 ].getBoundingClientRect(); }
	__getRowByIndex( ind ) { return this.__rows[ ind ]; }
	__getRowIndexByRow( row ) { return Array.prototype.indexOf.call( this.__rows, row ); }
	__getRowIndexByPageY( pageY ) {
		const ind = Math.floor( ( pageY - this.__getRow0BCR().top ) / this.__fontSize );

		return Math.max( 0, Math.min( ind, this.__rows.length - 1 ) );
	}
	__getWhenByPageX( pageX ) {
		return Math.max( 0, this.__uiTimeline.beatFloor(
			( pageX - this.__getRow0BCR().left ) / this.__pxPerBeat ) );
	}

	// Private util methods
	// ............................................................................................
	__resized() {
		this.__gridPanelResized();
	}
	__attached() {
		const elRows = this.__rowsContainer;

		this.__sideContent.style.right =
		this.__sideContent.style.bottom =
		elRows.style.right =
		elRows.style.bottom = -( elRows.offsetWidth - elRows.clientWidth ) + "px";
		this.__uiPanels.attached();
		this.__gridPanelResized();
	}
	__loop( isLoop, a, b ) {
		this._loop && this._loop( isLoop && a, b );
		this.__elLoopA.classList.toggle( "gsuiBlocksManager-loopOn", isLoop );
		this.__elLoopB.classList.toggle( "gsuiBlocksManager-loopOn", isLoop );
		if ( isLoop ) {
			this.__elLoopA.style.width = a + "em";
			this.__elLoopB.style.left = b + "em";
		}
	}
	__currentTime( t ) {
		this.__elCurrentTime.style.left = t + "em";
		this._currentTime && this._currentTime( t );
	}
	__isBlc( el ) {
		return el.classList.contains( "gsuiBlocksManager-block" );
	}
	__getBlc( el ) {
		if ( this.__isBlc( el ) ) {
			return el;
		} else if ( this.__isBlc( el.parentNode ) ) {
			return el.parentNode;
		} else if ( this.__isBlc( el.parentNode.parentNode ) ) {
			return el.parentNode.parentNode;
		}
	}
	__fillBlcsMap( blc ) {
		const blcs = this.__blcsEditing;

		if ( blc.classList.contains( "gsuiBlocksManager-block-selected" ) ) {
			this.__blcsSelected.forEach( ( blc, id ) => blcs.set( id, blc ) );
		} else {
			blcs.set( +blc.dataset.id, blc );
		}
		return blcs;
	}
	__unselectBlocks( obj ) {
		const dat = this._getData();

		this.__blcsSelected.forEach( ( blc, id ) => {
			if ( !( id in obj ) ) {
				dat[ id ].selected = false;
				obj[ id ] = { selected: false };
			}
		} );
		return obj;
	}
	__getBeatSnap() {
		return 1 / this.__uiTimeline._stepsPerBeat * this.__uiTimeline.stepRound;
	}
	__eventReset() {
		this.__mmFn =
		this.__valueA =
		this.__valueB = null;
		this.__valueAMin =
		this.__valueBMin = Infinity;
		this.__valueAMax =
		this.__valueBMax = -Infinity;
		this.__status = "";
		this.__blcsEditing.clear();
	}

	// Events
	// ............................................................................................
	__gridPanelResizing( pan ) {
		const width = pan.clientWidth;

		if ( this.__offset > 0 ) {
			this.__offset -= ( width - this.__elPanGridWidth ) / this.__pxPerBeat;
			this.__rowsContainer.scrollLeft -= width - this.__elPanGridWidth;
		}
		this.__gridPanelResized();
	}
	__gridPanelResized() {
		this.__elPanGridWidth = this.__elPanGrid.clientWidth;
		this.__uiTimeline.resized();
		this.__uiTimeline.offset( this.__offset, this.__pxPerBeat );
	}
	__onscrollPanelContent( e ) {
		if ( this.__sideContent.scrollTop !== this.__rowsScrollTop ) {
			this.__rowsScrollTop =
			this.__rowsContainer.scrollTop = this.__sideContent.scrollTop;
		}
	}
	__onwheelPanelContent( e ) {
		if ( e.ctrlKey ) {
			const layerY = e.pageY - this.__sideContent.firstElementChild.getBoundingClientRect().top,
				oldFs = this.__fontSize;

			this.setFontSize( oldFs * ( e.deltaY > 0 ? .9 : 1.1 ) );
			this.__rowsScrollTop =
			this.__sideContent.scrollTop =
			this.__rowsContainer.scrollTop += layerY / oldFs * ( this.__fontSize - oldFs );
		}
	}
	__onscrollRows( e ) {
		const elRows = this.__rowsContainer;

		this.__mousemove( e );
		if ( elRows.scrollTop !== this.__rowsScrollTop ) {
			this.__rowsScrollTop =
			this.__sideContent.scrollTop = elRows.scrollTop;
		}
		if ( elRows.scrollLeft !== this.__rowsScrollLeft ) {
			const off = elRows.scrollLeft / this.__pxPerBeat;

			this.__offset = off;
			this.__rowsScrollLeft = elRows.scrollLeft;
			this.__uiTimeline.offset( off, this.__pxPerBeat );
		}
		this._onscrollRows && this._onscrollRows();
	}
	__onwheelRows( e ) {
		if ( e.ctrlKey ) {
			const elRows = this.__rowsContainer,
				layerX = e.pageX - elRows.getBoundingClientRect().left + elRows.scrollLeft,
				ppb = Math.round( Math.min( Math.max( 8, this.__pxPerBeat * ( e.deltaY > 0 ? .9 : 1.1 ) ), 512 ) );

			this.__rowsScrollLeft =
			elRows.scrollLeft += layerX / this.__pxPerBeat * ( ppb - this.__pxPerBeat );
			this.__offset = elRows.scrollLeft / ppb;
			this.setPxPerBeat( ppb );
		}
	}
	__onclickMagnet() {
		const v = this.__uiTimeline.stepRound,
			frac =
				v >= 1 ? 2 :
				v >= .5 ? 4 :
				v >= .25 ? 8 : 1;

		this.__uiTimeline.stepRound = 1 / frac;
		this.__magnetValue.textContent = frac <= 1 ? "1" : "1 / " + frac;
		return false;
	}

	// Events to call manually
	// ............................................................................................
	__keyup() {}
	__keydown( e ) {
		const dat = this._getData(),
			blcsEditing = this.__blcsEditing;

		switch ( e.key ) {
			case "Delete":
				if ( this.__blcsSelected.size ) {
					this.__blcsSelected.forEach( ( blc, id ) => blcsEditing.set( id, blc ) );
					this.__status = "deleting";
					this.__mouseup();
				}
				break;
			case "b": // copy paste
				if ( e.ctrlKey || e.altKey ) {
					const blcsSel = this.__blcsSelected;

					if ( blcsSel.size ) {
						const data = this._getData();
						let whenMin = Infinity,
							whenMax = 0;

						blcsEditing.clear();
						blcsSel.forEach( ( blc, id ) => {
							const dat = data[ id ];

							whenMin = Math.min( whenMin, dat.when );
							whenMax = Math.max( whenMax, dat.when + dat.duration );
							blcsEditing.set( id, blc );
						} );
						whenMax = this.__uiTimeline.beatCeil( whenMax ) - whenMin;
						this.blcsManagerCallback( "duplicating", blcsEditing, whenMax );
						blcsEditing.clear();
					}
					e.preventDefault();
					e.stopPropagation();
				}
				break;
			case "a": // select all
			case "d": // deselect
				if ( e.ctrlKey || e.altKey ) {
					const adding = e.key === "a",
						blcs = adding ? this.__blcs : this.__blcsSelected;

					if ( blcs.size ) {
						let notEmpty;

						blcsEditing.clear();
						blcs.forEach( ( blc, id ) => {
							if ( !adding || !dat[ id ].selected ) {
								notEmpty = true;
								blcsEditing.set( id, blc );
							}
						} );
						if ( notEmpty ) {
							this.__status = "selecting-1";
							this.__mouseup();
						}
					}
					e.preventDefault();
					e.stopPropagation();
					gsuiBlocksManager._focused = this;
				}
				break;
		}
	}
	__mousemove( e ) {
		if ( this.__mmFn ) {
			if ( e.type === "mousemove" ) {
				this.__mmPageX = e.pageX;
				this.__mmPageY = e.pageY;
			}
			this.__mmWhen = this.__getWhenByPageX( this.__mmPageX );
			this.__mmFn.call( this, e );
		}
	}
	__mousedown( e ) {
		if ( !gsuiBlocksManager._focused ) {
			const blc = this.__getBlc( e.currentTarget );

			gsuiBlocksManager._focused = this;
			window.getSelection().removeAllRanges();
			this.__mdBlc = blc;
			if ( e.button === 2 ) {
				this.__mmFn = this.__mousemove_deletion;
				this.__status = "deleting";
				if ( blc ) {
					this.block_deleted( blc, true );
					this.__blcsEditing.set( +blc.dataset.id, blc );
				}
			} else if ( e.button === 0 ) {
				this.__mdPageX = e.pageX;
				this.__mdPageY = e.pageY;
				this.__mdWhen = this.__getWhenByPageX( e.pageX );
				this.__beatSnap = this.__getBeatSnap();
				if ( e.shiftKey ) {
					this.__mmFn = this.__mousemove_selection1;
					this.__status = "selecting-1";
					this.__mdRowInd = this.__getRowIndexByPageY( e.pageY );
				} else if ( blc ) {
					const data = this._getData(),
						blcsEditing = this.__fillBlcsMap( blc );

					blc.classList.add( "gsui-hover" );
					if ( e.target.classList.contains( "gsuiBlocksManager-block-crop" ) ) {
						this.__mmFn = this.__mousemove_crop;
						e.target.classList.add( "gsui-hover" );
						if ( e.target.classList.contains( "gsuiBlocksManager-block-cropA" ) ) {
							this.__status = "cropping-a";
							this.__valueAMin =
							this.__valueAMax = Infinity;
							blcsEditing.forEach( ( blc, id ) => {
								const dat = data[ id ];

								this.__valueAMin = Math.min( this.__valueAMin, dat.offset );
								this.__valueAMax = Math.min( this.__valueAMax, dat.duration );
							} );
							this.__valueAMin *= -1;
							this.__valueAMax = Math.max( 0, this.__valueAMax - this.__beatSnap );
						} else {
							this.__status = "cropping-b";
							this.__valueAMin =
							this.__valueAMax = Infinity;
							blcsEditing.forEach( ( blc, id ) => (
								this.__valueAMin = Math.min( this.__valueAMin, data[ id ].duration )
							) );
							this.__valueAMin = -Math.max( 0, this.__valueAMin - this.__beatSnap );
						}
					} else {
						this.__mmFn = this.__mousemove_move;
						this.__status = "moving";
						this.__mdRowInd = this.__getRowIndexByPageY( e.pageY );
						blcsEditing.forEach( ( blc, id ) => {
							const valB = this.__getRowIndexByRow( blc.parentNode.parentNode );

							this.__valueAMin = Math.min( this.__valueAMin, data[ id ].when );
							this.__valueBMin = Math.min( this.__valueBMin, valB );
							this.__valueBMax = Math.max( this.__valueBMax, valB );
						} );
						this.__valueAMin *= -1;
						this.__valueBMin *= -1;
						this.__valueBMax = this.__rows.length - 1 - this.__valueBMax;
					}
				}
			}
		}
	}
	__mouseup() {
		const blcsEditing = this.__blcsEditing,
			mdBlc = this.__mdBlc;

		switch ( this.__status ) {
			case "deleting":
				if ( blcsEditing.size || this.__blcsSelected.size ) {
					this.blcsManagerCallback( "deleting", blcsEditing );
				}
				break;
			case "moving":
				if ( this.__valueB || Math.abs( this.__valueA ) > .000001 ) {
					this.blcsManagerCallback( "moving", blcsEditing, this.__valueA, this.__valueB );
				}
				break;
			case "cropping-a":
			case "cropping-b":
				const child = mdBlc.children;

				child[ 0 ].classList.remove( "gsui-hover" );
				child[ 1 ] && child[ 1 ].classList.remove( "gsui-hover" );
				if ( Math.abs( this.__valueA ) > .000001 ) {
					this.blcsManagerCallback( this.__status, blcsEditing, this.__valueA );
				}
				break;
			case "selecting-2":
				this.__selection.classList.add( "gsuiBlocksManager-selection-hidden" );
			case "selecting-1":
				if ( this.__status === "selecting-1" && mdBlc ) {
					blcsEditing.set( +mdBlc.dataset.id, mdBlc );
				}
				if ( blcsEditing.size ) {
					this.blcsManagerCallback( "selecting", blcsEditing );
				}
				break;
		}
		this.__eventReset();
		if ( mdBlc ) {
			mdBlc.classList.remove( "gsui-hover" );
			delete this.__mdBlc;
		}
		delete gsuiBlocksManager._focused;
	}

	// Mousemove specific functions
	// ............................................................................................
	__mousemove_crop() {
		const croppingB = this.__status === "cropping-b",
			cropBrut = this.__beatSnap * Math.round( ( this.__mmWhen - this.__mdWhen ) / this.__beatSnap ),
			crop = Math.max( this.__valueAMin, Math.min( cropBrut, this.__valueAMax ) );

		if ( crop !== this.__valueA ) {
			const data = this._getData();

			this.__valueA = crop;
			this.__blcsEditing.forEach( ( blc, id ) => {
				const blcObj = Object.assign( {}, data[ id ] );

				if ( croppingB ) {
					blcObj.duration += crop;
				} else {
					blcObj.when += crop;
					blcObj.offset += crop;
					blcObj.duration -= crop;
					this.block_when( blc, blcObj.when );
					this.block_offset( blc, blcObj.offset );
				}
				this.block_duration( blc, blcObj.duration );
				this.oneditBlock( id, blcObj, blc );
			} );
		}
	}
	__mousemove_move() {
		const data = this._getData(),
			when = Math.max( this.__valueAMin,
				Math.round( ( this.__mmWhen - this.__mdWhen ) / this.__beatSnap ) * this.__beatSnap ),
			rows = Math.max( this.__valueBMin, Math.min( this.__valueBMax,
				this.__getRowIndexByPageY( this.__mmPageY ) - this.__mdRowInd ) );

		if ( when !== this.__valueA ) {
			this.__valueA = when;
			this.__blcsEditing.forEach( ( blc, id ) => this.block_when( blc, data[ id ].when + when ) );
		}
		if ( rows !== this.__valueB ) {
			this.__valueB = rows;
			this.__blcsEditing.forEach( ( blc, id ) => this.block_row( blc, rows ) );
		}
	}
	__mousemove_deletion( e ) {
		const blc = this.__getBlc( e.target );

		if ( blc && !this.__blcsEditing.has( +blc.dataset.id ) ) {
			this.block_deleted( blc, true );
			this.__blcsEditing.set( +blc.dataset.id, blc );
		}
	}
	__mousemove_selection1() {
		if ( Math.abs( this.__mmPageX - this.__mdPageX ) > 6 ||
			Math.abs( this.__mmPageY - this.__mdPageY ) > 6
		) {
			this.__status = "selecting-2";
			this.__mmFn = this.__mousemove_selection2;
			this.__selection.classList.remove( "gsuiBlocksManager-selection-hidden" );
			this.__mousemove_selection2();
		}
	}
	__mousemove_selection2() {
		const rowH = this.__fontSize,
			st = this.__selection.style,
			rowIndB = this.__getRowIndexByPageY( this.__mmPageY ),
			when = Math.min( this.__mdWhen, this.__mmWhen ),
			duration = this.__getBeatSnap() + Math.abs( this.__mdWhen - this.__mmWhen ),
			topRow = Math.min( this.__mdRowInd, rowIndB ),
			bottomRow = Math.max( this.__mdRowInd, rowIndB ),
			rowA = this.__getRowByIndex( topRow ),
			rowB = this.__getRowByIndex( bottomRow ),
			blcs = Object.entries( this._getData() )
				.reduce( ( map, [ id, blc ] ) => {
					id = +id;
					if ( !this.__blcsSelected.has( id ) &&
						blc.when < when + duration &&
						blc.when + blc.duration > when
					) {
						const elBlc = this.__blcs.get( id ),
							pA = rowA.compareDocumentPosition( elBlc ),
							pB = rowB.compareDocumentPosition( elBlc );

						if ( pA & Node.DOCUMENT_POSITION_CONTAINED_BY ||
							pB & Node.DOCUMENT_POSITION_CONTAINED_BY || (
							pA & Node.DOCUMENT_POSITION_FOLLOWING &&
							pB & Node.DOCUMENT_POSITION_PRECEDING )
						) {
							this.block_selected( elBlc, true );
							map.set( id, elBlc );
						}
					}
					return map;
				}, new Map );

		st.top = topRow * rowH + "px";
		st.left = when * this.__pxPerBeat + "px";
		st.width = duration * this.__pxPerBeat + "px";
		st.height = ( bottomRow - topRow + 1 ) * rowH + "px";
		this.__blcsEditing.forEach( ( blc, id ) => this.block_selected( blc, blcs.has( id ) ) );
		this.__blcsEditing = blcs;
	}
}

document.addEventListener( "mousemove", e => {
	gsuiBlocksManager._focused && gsuiBlocksManager._focused._mousemove( e );
} );
document.addEventListener( "mouseup", e => {
	gsuiBlocksManager._focused && gsuiBlocksManager._focused._mouseup( e );
} );
document.addEventListener( "keyup", e => {
	gsuiBlocksManager._focused && gsuiBlocksManager._focused._keyup( e );
} );
