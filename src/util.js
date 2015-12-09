
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
	var collect = [];
	var group = [];
	values.forEach(value=>{
		if (value) group.push(value);
		else {
			group = group.fill(max(group));
			collect = collect.concat(group, 0);
			group = [];
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
