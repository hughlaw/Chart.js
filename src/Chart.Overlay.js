(function() {
    "use strict";

    var root = this,
        Chart = root.Chart,
        helpers = Chart.helpers;
    //Overlay is a extention of the bar graph to allow the combination
    //of both line and bar charts on the same graph.
    //this graph extends the bar graph as the bar graphs scale is used due to 
    //it needing to detrmine x axis label width.
    Chart.types.Bar.extend({
        name: "Overlay",
        //merge defaults from both bar and line
        defaults: helpers.merge(Chart.types.Bar.prototype.defaults, helpers.merge(Chart.types.Line.prototype.defaults, {})),
        initialize: function(data) {
            //Expose options as a scope variable here so we can access it in the ScaleClass
            var options = this.options;
            //two new varibale to hold the different graph types
            this.barDatasets = [];
            this.lineDatasets = [];

            //generate the scale, let bar take control here as he needs the width.
            this.ScaleClass = Chart.Scale.extend({
                offsetGridLines: true,
                calculateBarX: function(datasetCount, datasetIndex, barIndex, overlayBars) {

                    if (overlayBars) {
                        datasetIndex = 0;
                    }
                    //Reusable method for calculating the xPosition of a given bar based on datasetIndex & width of the bar
                    var xWidth = this.calculateBaseWidth(),
                        xAbsolute = this.calculateX(barIndex) - (xWidth / 2),
                        barWidth = this.calculateBarWidth(datasetCount, overlayBars);

                    return xAbsolute + (barWidth * datasetIndex) + (datasetIndex * options.barDatasetSpacing) + barWidth / 2;
                },
                calculateBaseWidth: function() {
                    return (this.calculateX(1) - this.calculateX(0)) - (2 * options.barValueSpacing);
                },
                calculateBarWidth: function(datasetCount, overlayBars) {
                    if (overlayBars) {
                        datasetCount = 1;
                    }
                    //The padding between datasets is to the right of each bar, providing that there are more than 1 dataset
                    var baseWidth = this.calculateBaseWidth() - ((datasetCount - 1) * options.barDatasetSpacing);

                    return (baseWidth / datasetCount);
                }
            });

            //Declare the extension of the default point, to cater for the options passed in to the constructor
            this.PointClass = Chart.Point.extend({
                strokeWidth: this.options.pointDotStrokeWidth,
                radius: this.options.pointDotRadius,
                display: this.options.pointDot,
                hitDetectionRadius: this.options.pointHitDetectionRadius,
                ctx: this.chart.ctx,
                inRange: function(mouseX) {
                    return (Math.pow(mouseX - this.x, 2) < Math.pow(this.radius + this.hitDetectionRadius, 2));
                }
            });

            this.datasets = [];

            //Set up tooltip events on the chart
            if (this.options.showTooltips) {
                helpers.bindEvents(this, this.options.tooltipEvents, function(evt) {
                    var activeData = (evt.type !== 'mouseout') ? this.getDataAtEvent(evt) : [];

                    this.eachBars(function(bar) {
                        bar.restore(['fillColor', 'strokeColor']);
                    });
                    this.eachPoints(function(point) {
                        point.restore(['fillColor', 'strokeColor']);
                    });
                    helpers.each(activeData, function(active) {
                        if (active) {
                            active.fillColor = active.highlightFill;
                            active.strokeColor = active.highlightStroke;
                        }
                    });
                    this.showTooltip(activeData);
                });
            }

            //Declare the extension of the default Bar, to cater for the options passed in to the constructor
            this.BarClass = Chart.Rectangle.extend({
                strokeWidth: this.options.barStrokeWidth,
                showStroke: this.options.barShowStroke,
                ctx: this.chart.ctx
            });

            //Iterate through each of the datasets, and build this into a property of the chart
            helpers.each(data.datasets, function(dataset, datasetIndex) {

                var datasetObject = {
                    label: dataset.label || null,
                    fillColor: dataset.fillColor,
                    strokeColor: dataset.strokeColor,
                    type: dataset.type,
                    bars: [],
                    pointColor: dataset.pointColor,
                    pointStrokeColor: dataset.pointStrokeColor,
                    showTooltip: dataset.showTooltip,
                    points: []
                };

                this.datasets.push(datasetObject);
                switch (dataset.type) {
                    case "line":
                        this.lineDatasets.push(datasetObject);
                        helpers.each(dataset.data, function(dataPoint, index) {
                            //Add a new point for each piece of data, passing any required data to draw.
                            datasetObject.points.push(new this.PointClass({
                                ignore: dataPoint === null,
                                showTooltip: dataset.showTooltip === undefined ? true : dataset.showTooltip,
                                value: dataPoint,
                                label: data.labels[index],
                                datasetLabel: dataset.label,
                                strokeColor: dataset.pointStrokeColor,
                                fillColor: dataset.pointColor,
                                highlightFill: dataset.pointHighlightFill || dataset.pointColor,
                                highlightStroke: dataset.pointHighlightStroke || dataset.pointStrokeColor
                            }));
                        }, this);
                        break;

                    default:
                        this.barDatasets.push(datasetObject);
                        helpers.each(dataset.data, function(dataPoint, index) {
                            //Add a new point for each piece of data, passing any required data to draw.
                            datasetObject.bars.push(new this.BarClass({
                                value: dataPoint,
                                label: data.labels[index],
                                showTooltip: dataset.showTooltip === undefined ? true : dataset.showTooltip,
                                datasetLabel: dataset.label,
                                strokeColor: dataset.strokeColor,
                                fillColor: dataset.fillColor,
                                highlightFill: dataset.highlightFill || dataset.fillColor,
                                highlightStroke: dataset.highlightStroke || dataset.strokeColor
                            }));
                        }, this);

                        break;
                }


            }, this);

            this.buildScale(data.labels);

            helpers.each(this.lineDatasets, function(dataset, datasetIndex) {
                //Iterate through each of the datasets, and build this into a property of the chart
                this.eachPoints(function(point, index) {
                    helpers.extend(point, {
                        x: this.scale.calculateX(index),
                        y: this.scale.endPoint
                    });
                    point.save();
                }, this);
            }, this);

            this.BarClass.prototype.base = this.scale.endPoint;
            this.eachBars(function(bar, index, datasetIndex) {
                helpers.extend(bar, {
                    width: this.scale.calculateBarWidth(this.barDatasets.length, this.options.overlayBars),
                    x: this.scale.calculateBarX(this.barDatasets.length, datasetIndex, index, this.options.overlayBars),
                    y: this.scale.endPoint
                });
                bar.save();
            }, this);

            this.render();
        },

        getLastDataPoint: Chart.types.Line.prototype.getLastDataPoint,
        getNextDataPoint: Chart.types.Line.prototype.getNextDataPoint,
        getThisPoint: Chart.types.Line.prototype.getThisPoint,
        buildScale: function(labels) {
            var self = this;

            var dataTotal = function() {
                var values = [];
                self.eachBars(function(bar) {
                    values.push(bar.value);
                });
                self.eachPoints(function(point) {
                    values.push(point.value);
                });
                return values;
            };

            var scaleOptions = {
                labelLength: this.options.labelLength,
                labelsFilter: this.options.labelsFilter,
                templateString: this.options.scaleLabel,
                height: this.chart.height,
                width: this.chart.width,
                ctx: this.chart.ctx,
                textColor: this.options.scaleFontColor,
                fontSize: this.options.scaleFontSize,
                fontStyle: this.options.scaleFontStyle,
                fontFamily: this.options.scaleFontFamily,
                valuesCount: labels.length,
                beginAtZero: this.options.scaleBeginAtZero,
                integersOnly: this.options.scaleIntegersOnly,
                calculateYRange: function(currentHeight) {
                    var updatedRanges = helpers.calculateScaleRange(
                        dataTotal(),
                        currentHeight,
                        this.fontSize,
                        this.beginAtZero,
                        this.integersOnly
                    );
                    helpers.extend(this, updatedRanges);
                },
                xLabels: labels,
                font: helpers.fontString(this.options.scaleFontSize, this.options.scaleFontStyle, this.options.scaleFontFamily),
                lineWidth: this.options.scaleLineWidth,
                lineColor: this.options.scaleLineColor,
                gridLineWidth: (this.options.scaleShowGridLines) ? this.options.scaleGridLineWidth : 0,
                gridLineColor: (this.options.scaleShowGridLines) ? this.options.scaleGridLineColor : "rgba(0,0,0,0)",
                showHorizontalLines: this.options.scaleShowHorizontalLines,
                showVerticalLines: this.options.scaleShowVerticalLines,
                padding: (this.options.showScale) ? 0 : (this.options.barShowStroke) ? this.options.barStrokeWidth : 0,
                showLabels: this.options.scaleShowLabels,
                display: this.options.showScale
            };

            if (this.options.scaleOverride) {
                helpers.extend(scaleOptions, {
                    calculateYRange: helpers.noop,
                    steps: this.options.scaleSteps,
                    stepValue: this.options.scaleStepWidth,
                    min: this.options.scaleStartValue,
                    max: this.options.scaleStartValue + (this.options.scaleSteps * this.options.scaleStepWidth)
                });
            }

            this.scale = new this.ScaleClass(scaleOptions);
        },

        update: function() {
            this.scale.update();
            // Reset any highlight colours before updating.
            helpers.each(this.activeElements, function(activeElement) {
                activeElement.restore(['fillColor', 'strokeColor']);
            });

            this.eachBars(function(bar) {
                bar.save();
            });
            this.eachPoints(function(point) {
                point.save();
            });
            this.render();
        },
        eachPoints: function(callback) {
            //use the lineDataSets
            helpers.each(this.lineDatasets, function(dataset) {
                helpers.each(dataset.points, callback, this);
            }, this);
        },
        eachBars: function(callback) {
            //user the barDataSets
            helpers.each(this.barDatasets, function(dataset, datasetIndex) {
                helpers.each(dataset.bars, callback, this, datasetIndex);
            }, this);
        },

        getDataAtEvent: function(e) {
            //find points and bars at event, return as one array
            return this.getPointsAtEvent(e).concat(this.getBarsAtEvent(e));
        },
        getPointsAtEvent: function(e) {
            var pointsArray = [],
                eventPosition = helpers.getRelativePosition(e);
            helpers.each(this.lineDatasets, function(dataset) {
                helpers.each(dataset.points, function(point) {
                    if (point.inRange(eventPosition.x, eventPosition.y) && point.showTooltip) pointsArray.push(point);
                });
            }, this);
            return pointsArray;
        },
        getBarsAtEvent: function(e) {
            var barsArray = [],
                eventPosition = helpers.getRelativePosition(e),
                datasetIterator = function(dataset) {
                    barsArray.push(dataset.bars[barIndex]);
                },
                barIndex;
            for (var datasetIndex = 0; datasetIndex < this.barDatasets.length; datasetIndex++) {
                for (barIndex = 0; barIndex < this.barDatasets[datasetIndex].bars.length; barIndex++) {
                    if (this.barDatasets[datasetIndex].bars[barIndex].inRange(eventPosition.x, eventPosition.y) && this.barDatasets[datasetIndex].bars[barIndex].showTooltip) {
                        helpers.each(this.barDatasets, datasetIterator);
                        return barsArray;
                    }
                }
            }

            return barsArray;
        },
        addData: function(valuesArray, label) {
            //Map the values array for each of the datasets

            var lineDataSetIndex = 0;
            var barDataSetIndex = 0;
            helpers.each(valuesArray, function(value, datasetIndex) {
                switch (this.datasets[datasetIndex].type) {
                    case "line":
                        //Add a new point for each piece of data, passing any required data to draw.
                        this.lineDatasets[lineDataSetIndex].points.push(new this.PointClass({
                            value: value,
                            label: label,
                            x: this.scale.calculateX(this.scale.valuesCount + 1),
                            y: this.scale.endPoint,
                            strokeColor: this.lineDatasets[lineDataSetIndex].pointStrokeColor,
                            fillColor: this.lineDatasets[lineDataSetIndex].pointColor
                        }));
                        lineDataSetIndex++;
                        break;

                    default:
                        //Add a new point for each piece of data, passing any required data to draw.
                        this.barDatasets[barDataSetIndex].bars.push(new this.BarClass({
                            value: value,
                            label: label,
                            x: this.scale.calculateBarX(this.barDatasets.length, barDataSetIndex, this.scale.valuesCount + 1),
                            y: this.scale.endPoint,
                            width: this.scale.calculateBarWidth(this.barDatasets.length),
                            base: this.scale.endPoint,
                            strokeColor: this.barDatasets[barDataSetIndex].strokeColor,
                            fillColor: this.barDatasets[barDataSetIndex].fillColor
                        }));
                        barDataSetIndex++;
                        break;
                }
            }, this);
            this.scale.addXLabel(label);
            //Then re-render the chart.
            this.update();
        },
        removeData: function() {
            this.scale.removeXLabel();
            //Then re-render the chart.
            helpers.each(this.barDatasets, function(dataset) {
                dataset.bars.shift();
            }, this);

            helpers.each(this.lineDatasets, function(dataset) {
                dataset.points.shift();
            }, this);

            this.update();
        },
        reflow: function() {
            helpers.extend(this.BarClass.prototype, {
                y: this.scale.endPoint,
                base: this.scale.endPoint
            });
            var newScaleProps = helpers.extend({
                height: this.chart.height,
                width: this.chart.width
            });
            this.scale.update(newScaleProps);
        },
        draw: function(ease) {
            var easingDecimal = ease || 1;
            this.clear();

            this.scale.draw(easingDecimal);
            Chart.types.Bar.prototype.drawDatasets.call(this, this.barDatasets, easingDecimal);
            Chart.types.Line.prototype.drawDatasets.call(this, this.lineDatasets, easingDecimal);

        },
        showTooltip: function(ChartElements, forceRedraw) {
            // Only redraw the chart if we've actually changed what we're hovering on.
            if (typeof this.activeElements === 'undefined') this.activeElements = [];
            var isChanged = (function(Elements) {
                var changed = false;

                if (Elements.length !== this.activeElements.length) {
                    changed = true;
                    return changed;
                }

                helpers.each(Elements, function(element, index) {
                    if (element !== this.activeElements[index]) {
                        changed = true;
                    }
                }, this);
                return changed;
            }).call(this, ChartElements);

            if (!isChanged && !forceRedraw) {
                return;
            } else {
                this.activeElements = ChartElements;
            }
            this.draw();
            if (this.options.customTooltips) {
                this.options.customTooltips(false);
            }
            if (ChartElements.length > 0) {
                // If we have multiple datasets, show a MultiTooltip for all of the data points at that index
                if (this.datasets && this.datasets.length > 1) {
                    var dataArray,
                        dataIndex;

                    for (var i = this.lineDatasets.length - 1; i >= 0; i--) {
                        dataArray = this.lineDatasets[i].points;
                        dataIndex = helpers.indexOf(dataArray, ChartElements[0]);
                        if (dataIndex !== -1) {
                            break;
                        }
                    }
                    if (dataIndex === -1 || dataIndex === undefined) {
                        for (i = this.barDatasets.length - 1; i >= 0; i--) {
                            dataArray = this.barDatasets[i].bars;
                            dataIndex = helpers.indexOf(dataArray, ChartElements[0]);
                            if (dataIndex !== -1) {
                                break;
                            }
                        }
                    }
                    var tooltipLabels = [],
                        tooltipColors = [],
                        medianPosition = (function(index) {

                            // Get all the points at that particular index
                            var Elements = [],
                                dataCollection,
                                xPositions = [],
                                yPositions = [],
                                xMax,
                                yMax,
                                xMin,
                                yMin;
                            helpers.each(this.lineDatasets, function(dataset) {
                                dataCollection = dataset.points;
                                if (dataCollection[dataIndex] && dataCollection[dataIndex].hasValue() && (dataCollection[dataIndex].showTooltip === undefined || dataCollection[dataIndex].showTooltip)) {
                                    Elements.push(dataCollection[dataIndex]);
                                }
                            });
                            helpers.each(this.barDatasets, function(dataset) {
                                dataCollection = dataset.bars;
                                if (dataCollection[dataIndex] && dataCollection[dataIndex].hasValue() && (dataCollection[dataIndex].showTooltip === undefined || dataCollection[dataIndex].showTooltip)) {
                                    Elements.push(dataCollection[dataIndex]);
                                }
                            });
                            helpers.each(Elements, function(element) {
                                xPositions.push(element.x);
                                yPositions.push(element.y);


                                //Include any colour information about the element
                                tooltipLabels.push(helpers.template(this.options.multiTooltipTemplate, element));
                                tooltipColors.push({
                                    fill: element._saved.fillColor || element.fillColor,
                                    stroke: element._saved.strokeColor || element.strokeColor
                                });

                            }, this);

                            yMin = helpers.min(yPositions);
                            yMax = helpers.max(yPositions);

                            xMin = helpers.min(xPositions);
                            xMax = helpers.max(xPositions);

                            return {
                                x: (xMin > this.chart.width / 2) ? xMin : xMax,
                                y: (yMin + yMax) / 2
                            };
                        }).call(this, dataIndex);

                    new Chart.MultiTooltip({
                        x: medianPosition.x,
                        y: medianPosition.y,
                        xPadding: this.options.tooltipXPadding,
                        yPadding: this.options.tooltipYPadding,
                        xOffset: this.options.tooltipXOffset,
                        fillColor: this.options.tooltipFillColor,
                        textColor: this.options.tooltipFontColor,
                        fontFamily: this.options.tooltipFontFamily,
                        fontStyle: this.options.tooltipFontStyle,
                        fontSize: this.options.tooltipFontSize,
                        titleTextColor: this.options.tooltipTitleFontColor,
                        titleFontFamily: this.options.tooltipTitleFontFamily,
                        titleFontStyle: this.options.tooltipTitleFontStyle,
                        titleFontSize: this.options.tooltipTitleFontSize,
                        cornerRadius: this.options.tooltipCornerRadius,
                        labels: tooltipLabels,
                        legendColors: tooltipColors,
                        legendColorBackground: this.options.multiTooltipKeyBackground,
                        title: ChartElements[0].label,
                        chart: this.chart,
                        ctx: this.chart.ctx,
                        custom: this.options.customTooltips
                    }).draw();

                } else {
                    helpers.each(ChartElements, function(Element) {
                        var tooltipPosition = Element.tooltipPosition();
                        new Chart.Tooltip({
                            x: Math.round(tooltipPosition.x),
                            y: Math.round(tooltipPosition.y),
                            xPadding: this.options.tooltipXPadding,
                            yPadding: this.options.tooltipYPadding,
                            fillColor: this.options.tooltipFillColor,
                            textColor: this.options.tooltipFontColor,
                            fontFamily: this.options.tooltipFontFamily,
                            fontStyle: this.options.tooltipFontStyle,
                            fontSize: this.options.tooltipFontSize,
                            caretHeight: this.options.tooltipCaretSize,
                            cornerRadius: this.options.tooltipCornerRadius,
                            text: helpers.template(this.options.tooltipTemplate, Element),
                            chart: this.chart,
                            custom: this.options.customTooltips
                        }).draw();
                    }, this);
                }
            }
            return this;
        },
    });


}).call(this);
