
// max will return the max value in an array
export function max(values: Array<number>): number {
	return values.reduce((prev, val)=>{
		return prev > val ? prev : val;
	}, 0);
}

// groupMax will return an array of equal size, with contiguous non-zero entries
// set to be the max of the respective group
//
// for example [1,2,0,3,4,5] => [2,2,0,5,5,5]
export function groupMax(values: Array<number>): Array<number> {
	return groupMaxBoundaries(values, []);
}

// groupMaxBoundaries works just like `groupMax` except it will additionally reset on encountered indexes
// found in the `bounds` array. It is expected that `bounds` is sorted in ascending order.
export function groupMaxBoundaries(values: Array<number>, bounds: Array<number>): Array<number> {
	var collect = [];
	var group = [];
	var nextIndex = -1;
	if (bounds.length) {
		nextIndex = bounds[0];
		bounds = bounds.slice(1);
	}
	values.forEach((value, idx)=>{
		if (value && idx !== nextIndex) group.push(value);
		else {
			if (idx === nextIndex) {
				if (bounds.length) {
					nextIndex = bounds[0];
					bounds = bounds.slice(1);
				} else {
					nextIndex = -1;
				}

				collect = collect.concat(group.fill(max(group)));
				group = [value];
			} else {
				collect = collect.concat(group.fill(max(group)), 0);
				group = [];
			}
		}
	});
	if (group.length !== 0) {
		group = group.fill(max(group));
		collect = collect.concat(group);
	}
	return collect;
}

// groupMaxDiff will return an array of equal size, that is the difference of
// each element and it's respective `groupMax` value
export function groupMaxDiff(values: Array<number>): Array<number> {
	var gmax = groupMax(values);
	return values.map((val,idx)=>{
		return gmax[idx]-val;
	});
}

// groupMaxBoundariesDiff is the same as `groupMaxDiff` except it calls `groupMaxBoundaries`
export function groupMaxBoundariesDiff(values: Array<number>, bounds: Array<number>): Array<number> {
	var gmax = groupMaxBoundaries(values, bounds);
	return values.map((val,idx)=>{
		return gmax[idx]-val;
	});
}
